import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { BlaxelSandboxService } from "./blaxel.js";
import { BlaxelFunctionsService } from "./blaxel-functions.js";
import { BlaxelMcpService } from "./blaxel-mcp.js";
import { atlasServices, serviceBySlug } from "./services.js";
import { TelemetryStore } from "./store.js";
import type { McpName, TelemetryEvent } from "./types.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

const port = Number(process.env.PORT ?? 4000);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const store = new TelemetryStore();
const blaxel = new BlaxelSandboxService();
const blaxelFunctions = new BlaxelFunctionsService();
const blaxelMcp = new BlaxelMcpService();
let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function emit(event: TelemetryEvent) {
  store.ingest(event);
  io.emit("telemetry:event", event);
}

function emitHeartbeat(sourceMcp: McpName) {
  emit({
    eventId: nextId("evt"),
    traceId: nextId("hb"),
    requestId: nextId("heartbeat"),
    timestamp: Date.now(),
    sourceMcp,
    targetMcp: null,
    eventType: "HEARTBEAT",
    status: "info",
    latencyMs: 0,
    errorMessage: null,
  });
}

async function callService({
  traceId,
  requestId,
  sourceMcp,
  targetMcp,
  payload,
}: {
  traceId: string;
  requestId: string;
  sourceMcp: McpName;
  targetMcp: Exclude<McpName, "Gateway MCP">;
  payload: unknown;
}) {
  const start = Date.now();
  emit({
    eventId: nextId("evt"),
    traceId,
    requestId,
    timestamp: start,
    sourceMcp,
    targetMcp,
    eventType: "REQUEST_RECEIVED",
    status: "info",
    latencyMs: 0,
    errorMessage: null,
  });

  const targetService = atlasServices.find((service) => service.name === targetMcp);
  if (!targetService) {
    throw new Error(`Unknown target service ${targetMcp}`);
  }

  try {
    const response = await fetch(`${targetService.url}/tool`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latencyMs = Date.now() - start;

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp,
      targetMcp,
      eventType: "REQUEST_FORWARDED",
      status: response.ok ? "ok" : "error",
      latencyMs,
      errorMessage: response.ok ? null : `Forwarded request failed with ${response.status}`,
    });

    const data = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : `HTTP ${response.status}`);
    }

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: targetMcp,
      targetMcp: null,
      eventType: "REQUEST_COMPLETED",
      status: "ok",
      latencyMs,
      errorMessage: null,
    });

    return data;
  } catch (error) {
    const latencyMs = Date.now() - start;
    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: targetMcp,
      targetMcp: null,
      eventType: "REQUEST_FAILED",
      status: "error",
      latencyMs,
      errorMessage: error instanceof Error ? error.message : "Unknown forwarding error",
    });
    throw error;
  }
}

async function callBlaxelFunctionTool({
  traceId,
  requestId,
  functionName,
  toolName,
  payload,
}: {
  traceId: string;
  requestId: string;
  functionName: string;
  toolName: string;
  payload: Record<string, unknown>;
}) {
  const start = Date.now();
  emit({
    eventId: nextId("evt"),
    traceId,
    requestId,
    timestamp: start,
    sourceMcp: "Gateway MCP",
    targetMcp: "Atlas Blaxel MCP",
    eventType: "REQUEST_RECEIVED",
    status: "info",
    latencyMs: 0,
    errorMessage: null,
  });

  const target = await blaxelFunctions.resolveFunction(functionName);
  if (!target?.url) {
    throw new Error(`Blaxel function ${functionName} is not available`);
  }

  try {
    const result = await blaxelMcp.callToolAt(target.url, toolName, payload);
    const latencyMs = Date.now() - start;

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Gateway MCP",
      targetMcp: "Atlas Blaxel MCP",
      eventType: "REQUEST_FORWARDED",
      status: "ok",
      latencyMs,
      errorMessage: null,
    });

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Atlas Blaxel MCP",
      targetMcp: null,
      eventType: "REQUEST_COMPLETED",
      status: "ok",
      latencyMs,
      errorMessage: null,
    });

    return { function: target, result };
  } catch (error) {
    const latencyMs = Date.now() - start;
    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Atlas Blaxel MCP",
      targetMcp: null,
      eventType: "REQUEST_FAILED",
      status: "error",
      latencyMs,
      errorMessage: error instanceof Error ? error.message : "Blaxel function tool call failed",
    });
    throw error;
  }
}

async function callBlaxelSandboxTool({
  traceId,
  requestId,
  toolName,
  payload,
}: {
  traceId: string;
  requestId: string;
  toolName: string;
  payload: Record<string, unknown>;
}) {
  const start = Date.now();
  emit({
    eventId: nextId("evt"),
    traceId,
    requestId,
    timestamp: start,
    sourceMcp: "Gateway MCP",
    targetMcp: "Atlas Blaxel MCP",
    eventType: "REQUEST_RECEIVED",
    status: "info",
    latencyMs: 0,
    errorMessage: null,
  });

  try {
    const result = await blaxelMcp.callTool(toolName, payload);
    const latencyMs = Date.now() - start;

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Gateway MCP",
      targetMcp: "Atlas Blaxel MCP",
      eventType: "REQUEST_FORWARDED",
      status: "ok",
      latencyMs,
      errorMessage: null,
    });

    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Atlas Blaxel MCP",
      targetMcp: null,
      eventType: "REQUEST_COMPLETED",
      status: "ok",
      latencyMs,
      errorMessage: null,
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - start;
    emit({
      eventId: nextId("evt"),
      traceId,
      requestId,
      timestamp: Date.now(),
      sourceMcp: "Atlas Blaxel MCP",
      targetMcp: null,
      eventType: "REQUEST_FAILED",
      status: "error",
      latencyMs,
      errorMessage: error instanceof Error ? error.message : "Blaxel sandbox tool call failed",
    });
    throw error;
  }
}

async function heartbeatServices() {
  emitHeartbeat("Gateway MCP");
  await Promise.all(
    atlasServices.map(async (service) => {
      try {
        const response = await fetch(`${service.url}/health`);
        if (response.ok) {
          emitHeartbeat(service.name);
        }
      } catch {
        // No heartbeat event means the service will age into offline status.
      }
    }),
  );

  try {
    await blaxelMcp.ping();
    emitHeartbeat("Atlas Blaxel MCP");
  } catch {
    // Let the sandbox MCP age into offline if unreachable.
  }
}

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/snapshot", (_req, res) => {
  res.json(store.snapshot());
});

app.get("/api/integrations/blaxel", (_req, res) => {
  res.json(blaxel.getStatus());
});

app.get("/api/integrations/blaxel/functions", async (_req, res) => {
  try {
    const functions = await blaxelFunctions.listFunctions();
    res.json({ ok: true, functions });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel functions discovery failed",
    });
  }
});

app.get("/api/integrations/blaxel/functions/:functionName/test", async (req, res) => {
  try {
    const target = await blaxelFunctions.resolveFunction(req.params.functionName);
    if (!target || !target.url) {
      res.status(404).json({ ok: false, error: "Function not found or missing MCP URL" });
      return;
    }
    const tools = await blaxelMcp.listToolsAt(target.url);
    res.json({
      ok: true,
      function: target,
      toolCount: tools.tools.length,
      tools: tools.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel function MCP test failed",
    });
  }
});

app.get("/api/integrations/blaxel/functions/:functionName/tools", async (req, res) => {
  try {
    const target = await blaxelFunctions.resolveFunction(req.params.functionName);
    if (!target || !target.url) {
      res.status(404).json({ ok: false, error: "Function not found or missing MCP URL" });
      return;
    }
    const tools = await blaxelMcp.listToolsAt(target.url);
    res.json({
      ok: true,
      function: target,
      tools: tools.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel function tool discovery failed",
    });
  }
});

app.post("/api/integrations/blaxel/functions/:functionName/tools/:toolName", async (req, res) => {
  const traceId = nextId("trace");
  const requestId = nextId("req");
  try {
    const result = await callBlaxelFunctionTool({
      traceId,
      requestId,
      functionName: req.params.functionName,
      toolName: req.params.toolName,
      payload: (req.body ?? {}) as Record<string, unknown>,
    });
    res.json({
      ok: true,
      traceId,
      requestId,
      ...result,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      traceId,
      requestId,
      error: error instanceof Error ? error.message : "Blaxel function tool call failed",
    });
  }
});

app.get("/api/integrations/blaxel/mcp/ping", async (_req, res) => {
  try {
    const result = await blaxelMcp.ping();
    res.json({ ok: true, result });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel MCP ping failed",
    });
  }
});

app.get("/api/integrations/blaxel/mcp/tools", async (_req, res) => {
  try {
    const result = await blaxelMcp.listTools();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel MCP tools request failed",
    });
  }
});

app.post("/api/integrations/blaxel/mcp/tools/:toolName", async (req, res) => {
  try {
    const result = await blaxelMcp.callTool(req.params.toolName, req.body ?? {});
    res.json({ ok: true, result });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Blaxel MCP tool call failed",
    });
  }
});

app.post("/api/integrations/blaxel/mcp/demo/processes-list", async (_req, res) => {
  const traceId = nextId("trace");
  const requestId = nextId("req");
  try {
    const result = await callBlaxelSandboxTool({
      traceId,
      requestId,
      toolName: "processesList",
      payload: {},
    });
    res.json({ ok: true, traceId, requestId, result });
  } catch (error) {
    res.status(502).json({
      ok: false,
      traceId,
      requestId,
      error: error instanceof Error ? error.message : "Blaxel sandbox demo failed",
    });
  }
});

app.get("/api/services", (_req, res) => {
  res.json(atlasServices);
});

app.post("/proxy/:mcpName", async (req, res) => {
  const targetService = serviceBySlug[req.params.mcpName as keyof typeof serviceBySlug];
  if (!targetService) {
    res.status(404).json({ error: "Unknown MCP service" });
    return;
  }

  const traceId = nextId("trace");
  const requestId = nextId("req");

  try {
    const data = await callService({
      traceId,
      requestId,
      sourceMcp: "Gateway MCP",
      targetMcp: targetService.name,
      payload: req.body,
    });
    res.json({ traceId, requestId, target: targetService.name, data });
  } catch (error) {
    res.status(502).json({
      traceId,
      requestId,
      target: targetService.name,
      error: error instanceof Error ? error.message : "Proxy request failed",
    });
  }
});

app.post("/api/demo/agent-task", async (req, res) => {
  const traceId = nextId("trace");
  const requestId = nextId("req");
  const query = String(req.body?.query ?? "alignment observability");
  const forceFileFailure = Boolean(req.body?.forceFileFailure);

  try {
    const search = await callService({
      traceId,
      requestId,
      sourceMcp: "Gateway MCP",
      targetMcp: "Search MCP",
      payload: { query },
    });
    const memory = await callService({
      traceId,
      requestId,
      sourceMcp: "Search MCP",
      targetMcp: "Memory MCP",
      payload: { topic: query, userId: "u1" },
    });
    const file = await callService({
      traceId,
      requestId,
      sourceMcp: "Memory MCP",
      targetMcp: "File MCP",
      payload: { filename: "atlas-notes.txt", forceFailure: forceFileFailure },
    });

    res.json({
      traceId,
      requestId,
      result: {
        search,
        memory,
        file,
      },
    });
  } catch (error) {
    res.status(502).json({
      traceId,
      requestId,
      error: error instanceof Error ? error.message : "Agent task failed",
    });
  }
});

io.on("connection", (socket) => {
  socket.emit("dashboard:snapshot", store.snapshot());
});

setInterval(() => {
  io.emit("dashboard:snapshot", store.snapshot());
}, 2_000);

await blaxel.initialize();
await heartbeatServices();
setInterval(() => {
  void heartbeatServices();
}, 4_000);

httpServer.listen(port, () => {
  console.log(`MCP Atlas server listening on http://localhost:${port}`);
});

const shutdown = () => {
  io.close();
  httpServer.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
