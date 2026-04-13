import { describe, expect, it } from "vitest";
import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { buildTopologyElements } from "./build-topology-elements";

describe("buildTopologyElements", () => {
  it("creates tool nodes attached to MCP nodes", () => {
    const snapshot: DashboardSnapshot = {
      generatedAt: Date.now(),
      overview: {
        totalServers: 1,
        activeServers: 1,
        requestsLastMinute: 1,
        averageLatencyMs: 100,
        failedRequests: 0,
        anomalyCount: 0,
      },
      servers: [
        {
          name: "Search MCP",
          status: "online",
          heartbeatAt: Date.now(),
          requestsPerMinute: 1,
          averageLatencyMs: 100,
          p95LatencyMs: 100,
          errorRate: 0,
          throughput: 1,
          inFlight: 0,
        },
      ],
      toolsets: [
        {
          server: "Search MCP",
          tools: [
            {
              id: "search",
              name: "search",
              description: "Search",
              requestCount: 3,
              averageLatencyMs: 90,
            },
          ],
        },
      ],
      traces: [],
      dependencies: [],
      alerts: [],
      timeseries: [],
    };

    const elements = buildTopologyElements(snapshot);

    expect(elements.flat.some((element) => element.data.id === "Search MCP::search")).toBe(true);
  });
});
