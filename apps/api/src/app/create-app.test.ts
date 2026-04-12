import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { TelemetryStore } from "../store.js";
import { createApp } from "./create-app.js";
import type { ApiRuntime } from "./runtime.js";

const snapshot: DashboardSnapshot = {
  generatedAt: 1,
  overview: {
    totalServers: 5,
    activeServers: 5,
    requestsLastMinute: 3,
    averageLatencyMs: 120,
    failedRequests: 0,
    anomalyCount: 0,
  },
  servers: [],
  toolsets: [],
  traces: [],
  dependencies: [],
  alerts: [],
  timeseries: [],
};

describe("createApp", () => {
  it("exposes the frontend compatibility HTTP surface", async () => {
    const runtime: ApiRuntime = {
      store: new TelemetryStore(),
      registryService: {
        listMcps: async () => [],
        getAdapter: () => null,
      },
      services: {
        telemetry: {
          ingest: vi.fn(),
          snapshot: vi.fn().mockReturnValue(snapshot),
        },
        topology: {
          fromSnapshot: vi.fn().mockReturnValue({
            nodes: [],
            edges: [],
            toolsets: [],
          }),
        },
        anomalies: {
          list: vi.fn().mockReturnValue([]),
        },
        traces: {
          list: vi.fn().mockReturnValue([]),
          getById: vi.fn().mockReturnValue(null),
        },
      },
      compatibility: {
        getSnapshot: vi.fn().mockReturnValue(snapshot),
        getBlaxelStatus: vi.fn().mockReturnValue({
          enabled: true,
          connected: true,
          sandboxName: "atlas-sandbox",
          sandboxUrl: "https://sandbox.example",
          sandboxMcpUrl: "https://sandbox.example/mcp",
          workspace: "dk09",
          lastError: null,
        }),
        listBlaxelFunctions: vi.fn().mockResolvedValue([
          {
            name: "mcp-atlas-tools",
            displayName: "mcp-atlas-tools",
            transport: "http-stream",
            url: "https://run.blaxel.ai/dk09/functions/mcp-atlas-tools/mcp",
            enabled: true,
            status: "online",
          },
        ]),
        testBlaxelFunction: vi.fn().mockResolvedValue({
          ok: true,
          toolCount: 1,
          tools: [{ name: "atlasSearch", description: "Search Atlas data" }],
        }),
        listBlaxelTools: vi.fn().mockResolvedValue({
          ok: true,
          tools: [{ name: "atlasSearch", description: "Search Atlas data" }],
        }),
        callBlaxelFunctionTool: vi.fn().mockResolvedValue({
          ok: true,
          traceId: "trace-fn",
          requestId: "req-fn",
          result: { ok: true },
        }),
        pingBlaxelMcp: vi.fn().mockResolvedValue({ ok: true, result: {} }),
        listBlaxelMcpTools: vi.fn().mockResolvedValue({
          ok: true,
          tools: [{ name: "processesList", description: "List sandbox processes" }],
        }),
        callBlaxelMcpTool: vi.fn().mockResolvedValue({ ok: true, result: { ok: true } }),
        runBlaxelProcessesList: vi.fn().mockResolvedValue({
          ok: true,
          traceId: "trace-blaxel",
          requestId: "req-blaxel",
          result: { processes: [{ pid: 1 }] },
        }),
        listServices: vi.fn().mockReturnValue([
          { slug: "search-mcp", name: "Search MCP", url: "http://localhost:4001" },
        ]),
        proxyRequest: vi.fn().mockResolvedValue({
          traceId: "trace-proxy",
          requestId: "req-proxy",
          target: "Search MCP",
          data: { tool: "search", results: ["a"] },
        }),
        runAgentTask: vi.fn().mockResolvedValue({
          traceId: "trace-agent",
          requestId: "req-agent",
          result: { ok: true },
        }),
      },
    };
    const app = createApp(runtime);

    const [snapshotResponse, functionsResponse, proxyResponse, agentResponse, blaxelResponse] = await Promise.all([
      request(app).get("/api/snapshot"),
      request(app).get("/api/integrations/blaxel/functions"),
      request(app).post("/proxy/search-mcp").send({ query: "atlas" }),
      request(app).post("/api/demo/agent-task").send({ query: "atlas" }),
      request(app).post("/api/integrations/blaxel/mcp/demo/processes-list").send({}),
    ]);

    expect(snapshotResponse.status).toBe(200);
    expect(snapshotResponse.body.overview.requestsLastMinute).toBe(3);

    expect(functionsResponse.status).toBe(200);
    expect(functionsResponse.body).toEqual({
      ok: true,
      functions: [
        {
          name: "mcp-atlas-tools",
          displayName: "mcp-atlas-tools",
          transport: "http-stream",
          url: "https://run.blaxel.ai/dk09/functions/mcp-atlas-tools/mcp",
          enabled: true,
          status: "online",
        },
      ],
    });

    expect(proxyResponse.status).toBe(200);
    expect(proxyResponse.body.traceId).toBe("trace-proxy");

    expect(agentResponse.status).toBe(200);
    expect(agentResponse.body.traceId).toBe("trace-agent");

    expect(blaxelResponse.status).toBe(200);
    expect(blaxelResponse.body.traceId).toBe("trace-blaxel");
  });
});
