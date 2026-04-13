import { describe, expect, it } from "vitest";
import { DashboardSnapshotSchema, McpRegistryRecordSchema } from "./dashboard.js";

describe("dashboard contracts", () => {
  it("parses a valid DashboardSnapshot payload with numeric timestamps", () => {
    const payload = {
      generatedAt: 1712952000000,
      overview: {
        totalServers: 5,
        activeServers: 4,
        requestsLastMinute: 120,
        averageLatencyMs: 42.5,
        failedRequests: 2,
        anomalyCount: 1,
      },
      servers: [
        {
          name: "Gateway Edge",
          status: "online",
          heartbeatAt: 1712951970000,
          requestsPerMinute: 50,
          averageLatencyMs: 12.4,
          p95LatencyMs: 25.2,
          errorRate: 0.02,
          throughput: 48,
          inFlight: 3,
        },
      ],
      toolsets: [
        {
          server: "Search Cluster A",
          tools: [
            {
              id: "tool-search-1",
              name: "search_documents",
              description: "Search indexed documents",
              requestCount: 75,
              averageLatencyMs: 18.3,
            },
          ],
        },
      ],
      traces: [
        {
          traceId: "trace-1",
          requestId: "request-1",
          origin: "Gateway Edge",
          path: ["Gateway Edge", "Search Cluster A"],
          totalLatencyMs: 31.7,
          status: "success",
          startedAt: 1712951939000,
          updatedAt: 1712951940000,
          hops: [
            {
              source: "Gateway Edge",
              target: "Search Cluster A",
              latencyMs: 31.7,
              status: "ok",
              timestamp: 1712951939900,
              errorMessage: null,
              eventType: "REQUEST_COMPLETED",
            },
          ],
        },
      ],
      dependencies: [
        {
          source: "Gateway Edge",
          target: "Search Cluster A",
          volume: 80,
          averageLatencyMs: 19.1,
        },
      ],
      alerts: [
        {
          id: "alert-1",
          severity: "low",
          kind: "latency",
          title: "Latency elevated",
          detail: "Search Cluster A latency is above baseline",
          server: "Search Cluster A",
          timestamp: 1712952000000,
        },
      ],
      timeseries: [
        {
          timestamp: 1712951940000,
          requests: 120,
          failures: 2,
          averageLatencyMs: 42.5,
        },
      ],
    };

    expect(DashboardSnapshotSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a snapshot without overview", () => {
    const payload = {
      generatedAt: 1712952000000,
      servers: [],
      toolsets: [],
      traces: [],
      dependencies: [],
      alerts: [],
      timeseries: [],
    };

    expect(() => DashboardSnapshotSchema.parse(payload)).toThrow();
  });

  it("parses an MCP registry record", () => {
    const payload = {
      slug: "search-mcp",
      name: "Search MCP",
      transport: "stdio",
      status: "configured",
      tools: [
        {
          id: "tool-search-1",
          name: "search_documents",
          description: "Search indexed documents",
          requestCount: 75,
          averageLatencyMs: 18.3,
        },
      ],
    };

    expect(McpRegistryRecordSchema.parse(payload)).toEqual(payload);
  });
});
