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
import type { DashboardSnapshot, McpName, McpToolInfo, McpToolset, TelemetryEvent } from "./types.js";

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
const toolInvocations: Array<{
  server: McpName;
  toolId: string;
  timestamp: number;
  latencyMs: number;
  status: "ok" | "error";
}> = [];
let cachedBlaxelTools: McpToolInfo[] = [
  {
    id: "processesList",
    name: "processesList",
    description: "List running processes in the connected Blaxel sandbox.",
    requestCount: 0,
    averageLatencyMs: 0,
  },
];
let lastBlaxelToolRefreshAt = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function emit(event: TelemetryEvent) {
  store.ingest(event);
  io.emit("telemetry:event", event);
}

function recordToolInvocation(entry: {
  server: McpName;
  toolId: string;
  latencyMs: number;
  status: "ok" | "error";
}) {
  toolInvocations.push({
    ...entry,
    timestamp: Date.now(),
  });

  if (toolInvocations.length > 2000) {
    toolInvocations.splice(0, toolInvocations.length - 2000);
  }
}

function buildToolMetrics(now = Date.now()) {
  const recent = toolInvocations.filter((entry) => now - entry.timestamp <= 60_000);
  const aggregates = new Map<string, { count: number; totalLatencyMs: number }>();

  for (const entry of recent) {
    const key = `${entry.server}::${entry.toolId}`;
    const aggregate = aggregates.get(key) ?? { count: 0, totalLatencyMs: 0 };
    aggregate.count += 1;
    aggregate.totalLatencyMs += entry.latencyMs;
    aggregates.set(key, aggregate);
  }

  return aggregates;
}

function buildToolsets(now = Date.now()): McpToolset[] {
  const metrics = buildToolMetrics(now);
  const withMetrics = (server: McpName, tool: Omit<McpToolInfo, "requestCount" | "averageLatencyMs">): McpToolInfo => {
    const metric = metrics.get(`${server}::${tool.id}`);
    return {
      ...tool,
      requestCount: metric?.count ?? 0,
      averageLatencyMs: metric?.count ? Math.round(metric.totalLatencyMs / metric.count) : 0,
    };
  };

  return [
    {
      server: "Gateway MCP",
      tools: [
        withMetrics("Gateway MCP", {
          id: "agent-task",
          name: "agentTask",
          description: "Run the local multi-hop Atlas workflow.",
        }),
      ],
    },
    ...atlasServices.map((service) => ({
      server: service.name,
      tools: service.tools.map((tool) => withMetrics(service.name, {
        id: tool.id,
        name: tool.name,
        description: tool.description,
      })),
    })),
    {
      server: "Atlas Blaxel MCP",
      tools: cachedBlaxelTools.map((tool) => withMetrics("Atlas Blaxel MCP", tool)),
    },
  ];
}

function buildDashboardSnapshot(): DashboardSnapshot {
  return {
    ...store.snapshot(),
    toolsets: buildToolsets(),
  };
}

async function refreshBlaxelTools(force = false) {
  const now = Date.now();
  if (!force && now - lastBlaxelToolRefreshAt < 60_000) {
    return;
  }

  try {
    const result = await blaxelMcp.listTools();
    const discovered = result.tools
      .slice(0, 4)
      .map((tool) => ({
        id: tool.name,
        name: tool.name,
        description: tool.description ?? null,
        requestCount: 0,
        averageLatencyMs: 0,
      }));

    if (discovered.length > 0) {
      cachedBlaxelTools = discovered;
      lastBlaxelToolRefreshAt = now;
    }
  } catch {
    // Keep last known tool catalog if discovery fails.
  }
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

    recordToolInvocation({
      server: targetMcp,
      toolId: targetService.tools[0]?.id ?? targetService.slug,
      latencyMs,
      status: "ok",
    });

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
    recordToolInvocation({
      server: targetMcp,
      toolId: targetService.tools[0]?.id ?? targetService.slug,
      latencyMs,
      status: "error",
    });
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
    recordToolInvocation({
      server: "Atlas Blaxel MCP",
      toolId: toolName,
      latencyMs,
      status: "ok",
    });

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
    recordToolInvocation({
      server: "Atlas Blaxel MCP",
      toolId: toolName,
      latencyMs,
      status: "error",
    });
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
    recordToolInvocation({
      server: "Atlas Blaxel MCP",
      toolId: toolName,
      latencyMs,
      status: "ok",
    });

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
    recordToolInvocation({
      server: "Atlas Blaxel MCP",
      toolId: toolName,
      latencyMs,
      status: "error",
    });
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
    await refreshBlaxelTools();
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
  res.json(buildDashboardSnapshot());
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
  const startedAt = Date.now();

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

    recordToolInvocation({
      server: "Gateway MCP",
      toolId: "agent-task",
      latencyMs: Date.now() - startedAt,
      status: "ok",
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
    recordToolInvocation({
      server: "Gateway MCP",
      toolId: "agent-task",
      latencyMs: Date.now() - startedAt,
      status: "error",
    });
    res.status(502).json({
      traceId,
      requestId,
      error: error instanceof Error ? error.message : "Agent task failed",
    });
  }
});

io.on("connection", (socket) => {
  socket.emit("dashboard:snapshot", buildDashboardSnapshot());
});

setInterval(() => {
  io.emit("dashboard:snapshot", buildDashboardSnapshot());
}, 2_000);

await blaxel.initialize();
await refreshBlaxelTools(true);
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
