import type { DashboardSnapshot, TelemetryEvent } from "@mcp-atlas/contracts";
import dotenv from "dotenv";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createApp } from "./app/create-app.js";
import { createRuntime } from "./app/runtime.js";
import { BlaxelSandboxService } from "./blaxel.js";
import { BlaxelFunctionsService } from "./blaxel-functions.js";
import { BlaxelMcpService } from "./blaxel-mcp.js";
import { atlasServices, serviceBySlug } from "./services.js";
import type { McpName, McpToolInfo, McpToolset } from "./types.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

const port = Number(process.env.PORT ?? 4000);
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
  runtime.services.telemetry.ingest(event);
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
      tools: service.tools.map((tool) =>
        withMetrics(service.name, {
          id: tool.id,
          name: tool.name,
          description: tool.description,
        }),
      ),
    })),
    {
      server: "Atlas Blaxel MCP",
      tools: cachedBlaxelTools.map((tool) => withMetrics("Atlas Blaxel MCP", tool)),
    },
  ];
}

function buildDashboardSnapshot(): DashboardSnapshot {
  return runtime.services.telemetry.snapshot();
}

async function refreshBlaxelTools(force = false) {
  const now = Date.now();
  if (!force && now - lastBlaxelToolRefreshAt < 60_000) {
    return;
  }

  try {
    const result = await blaxelMcp.listTools();
    const discovered = result.tools.slice(0, 4).map((tool) => ({
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
    // Keep the last known tool catalog if discovery fails.
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
      throw new Error(
        typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : `HTTP ${response.status}`,
      );
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
    throw new Error("Function not found or missing MCP URL");
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

async function listRegistryMcps() {
  const snapshot = buildDashboardSnapshot();
  const statusByName = new Map(snapshot.servers.map((server) => [server.name, server.status]));
  const toolsetsByServer = new Map(snapshot.toolsets.map((toolset) => [toolset.server, toolset.tools]));
  const records: Array<{
    slug: string;
    name: string;
    transport: string;
    status: "online" | "degraded" | "offline" | "configured";
    tools: McpToolInfo[];
    url: string | null;
  }> = atlasServices.map((service) => ({
    slug: service.slug,
    name: service.name,
    transport: "http",
    status: statusByName.get(service.name) ?? "offline",
    tools: toolsetsByServer.get(service.name) ?? [],
    url: service.url,
  }));

  records.push({
    slug: "atlas-blaxel-mcp",
    name: "Atlas Blaxel MCP",
    transport: "http-stream",
    status: statusByName.get("Atlas Blaxel MCP") ?? "configured",
    tools: toolsetsByServer.get("Atlas Blaxel MCP") ?? [],
    url: blaxel.getStatus().sandboxMcpUrl,
  });

  return records;
}

const runtime = createRuntime(
  {
    listMcps: listRegistryMcps,
  },
  {
    getSnapshot: buildDashboardSnapshot,
    getBlaxelStatus: () => blaxel.getStatus(),
    listBlaxelFunctions: () => blaxelFunctions.listFunctions(),
    testBlaxelFunction: async (functionName) => {
      const target = await blaxelFunctions.resolveFunction(functionName);
      if (!target?.url) {
        return { ok: false, error: "Function not found or missing MCP URL" };
      }

      const tools = await blaxelMcp.listToolsAt(target.url);
      return {
        ok: true,
        function: target,
        toolCount: tools.tools.length,
        tools: tools.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      };
    },
    listBlaxelTools: async (functionName) => {
      const target = await blaxelFunctions.resolveFunction(functionName);
      if (!target?.url) {
        return { ok: false, error: "Function not found or missing MCP URL" };
      }

      const tools = await blaxelMcp.listToolsAt(target.url);
      return {
        ok: true,
        function: target,
        tools: tools.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      };
    },
    callBlaxelFunctionTool: async (functionName, toolName, payload) => {
      const traceId = nextId("trace");
      const requestId = nextId("req");
      const result = await callBlaxelFunctionTool({
        traceId,
        requestId,
        functionName,
        toolName,
        payload,
      });
      return {
        ok: true,
        traceId,
        requestId,
        ...result,
      };
    },
    pingBlaxelMcp: async () => ({
      ok: true,
      result: await blaxelMcp.ping(),
    }),
    listBlaxelMcpTools: async () => ({
      ok: true,
      ...(await blaxelMcp.listTools()),
    }),
    callBlaxelMcpTool: async (toolName, payload) => ({
      ok: true,
      result: await blaxelMcp.callTool(toolName, payload),
    }),
    runBlaxelProcessesList: async () => {
      const traceId = nextId("trace");
      const requestId = nextId("req");
      const result = await callBlaxelSandboxTool({
        traceId,
        requestId,
        toolName: "processesList",
        payload: {},
      });
      return { ok: true, traceId, requestId, result };
    },
    listServices: () => atlasServices,
    proxyRequest: async (mcpName, payload) => {
      const targetService = serviceBySlug[mcpName as keyof typeof serviceBySlug];
      if (!targetService) {
        throw new Error("Unknown MCP service");
      }

      const traceId = nextId("trace");
      const requestId = nextId("req");
      const data = await callService({
        traceId,
        requestId,
        sourceMcp: "Gateway MCP",
        targetMcp: targetService.name,
        payload,
      });

      return {
        traceId,
        requestId,
        target: targetService.name,
        data,
      };
    },
    runAgentTask: async (payload) => {
      const traceId = nextId("trace");
      const requestId = nextId("req");
      const query =
        typeof payload === "object" && payload && "query" in payload
          ? String((payload as { query?: unknown }).query ?? "alignment observability")
          : "alignment observability";
      const forceFileFailure =
        typeof payload === "object" && payload && "forceFileFailure" in payload
          ? Boolean((payload as { forceFileFailure?: unknown }).forceFileFailure)
          : false;
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

        return {
          traceId,
          requestId,
          result: {
            search,
            memory,
            file,
          },
        };
      } catch (error) {
        recordToolInvocation({
          server: "Gateway MCP",
          toolId: "agent-task",
          latencyMs: Date.now() - startedAt,
          status: "error",
        });
        throw error instanceof Error ? error : new Error("Agent task failed");
      }
    },
  },
  {
    snapshotDecorator: (snapshot) => ({
      ...snapshot,
      toolsets: buildToolsets(),
    }),
  },
);

const app = createApp(runtime);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
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
  console.log(`MCP Atlas API running on http://localhost:${port}`);
});

const shutdown = () => {
  io.close();
  httpServer.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
