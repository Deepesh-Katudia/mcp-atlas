import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import type { BlaxelFunctionRecord } from "../../types";
import { buildTopologyElements } from "../topology/build-topology-elements";
import { OverviewSummary } from "./OverviewSummary";

vi.mock("../topology/TopologyGraph", () => ({
  TopologyGraph: () => <div>Topology graph preview</div>,
}));

vi.mock("./OverviewCards", () => ({
  MetricCard: ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  ),
  TrafficChart: () => <div>Traffic chart preview</div>,
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const snapshot: DashboardSnapshot = {
  generatedAt: 1713124800000,
  overview: {
    totalServers: 4,
    activeServers: 3,
    requestsLastMinute: 128,
    averageLatencyMs: 94,
    failedRequests: 7,
    anomalyCount: 2,
  },
  servers: [
    {
      name: "Gateway MCP",
      status: "online",
      heartbeatAt: 1713124800000,
      requestsPerMinute: 128,
      averageLatencyMs: 50,
      p95LatencyMs: 70,
      errorRate: 0.02,
      throughput: 20,
      inFlight: 2,
    },
    {
      name: "Search MCP",
      status: "online",
      heartbeatAt: 1713124800000,
      requestsPerMinute: 64,
      averageLatencyMs: 96,
      p95LatencyMs: 122,
      errorRate: 0.03,
      throughput: 12,
      inFlight: 1,
    },
    {
      name: "Memory MCP",
      status: "degraded",
      heartbeatAt: 1713124800000,
      requestsPerMinute: 22,
      averageLatencyMs: 132,
      p95LatencyMs: 190,
      errorRate: 0.05,
      throughput: 7,
      inFlight: 1,
    },
    {
      name: "Atlas Blaxel MCP",
      status: "offline",
      heartbeatAt: 1713124700000,
      requestsPerMinute: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      errorRate: 0,
      throughput: 0,
      inFlight: 0,
    },
  ],
  toolsets: [
    {
      server: "Search MCP",
      tools: [
        {
          id: "search-web",
          name: "search_web",
          description: "Search the web",
          requestCount: 18,
          averageLatencyMs: 90,
        },
      ],
    },
    {
      server: "Memory MCP",
      tools: [
        {
          id: "memory-read",
          name: "memory_read",
          description: "Read memory",
          requestCount: 12,
          averageLatencyMs: 110,
        },
      ],
    },
  ],
  traces: [
    {
      traceId: "trace-001",
      requestId: "req-001",
      origin: "Gateway MCP",
      path: ["Gateway MCP", "Search MCP", "Memory MCP"],
      totalLatencyMs: 214,
      status: "failed",
      startedAt: 1713124700000,
      updatedAt: 1713124800000,
      hops: [
        {
          source: "Gateway MCP",
          target: "Search MCP",
          latencyMs: 84,
          status: "ok",
          timestamp: 1713124750000,
          errorMessage: null,
          eventType: "REQUEST_FORWARDED",
        },
        {
          source: "Search MCP",
          target: "Memory MCP",
          latencyMs: 130,
          status: "error",
          timestamp: 1713124800000,
          errorMessage: "Timeout while requesting memory context",
          eventType: "REQUEST_FAILED",
        },
      ],
    },
  ],
  dependencies: [
    {
      source: "Gateway MCP",
      target: "Search MCP",
      volume: 88,
      averageLatencyMs: 82,
    },
    {
      source: "Search MCP",
      target: "Memory MCP",
      volume: 24,
      averageLatencyMs: 130,
    },
  ],
  alerts: [
    {
      id: "alert-1",
      severity: "high",
      kind: "failure",
      title: "Memory timeout spike",
      detail: "Timeouts crossed 5% over the last five minutes.",
      server: "Memory MCP",
      timestamp: 1713124800000,
    },
    {
      id: "alert-2",
      severity: "medium",
      kind: "latency",
      title: "Search latency elevated",
      detail: "P95 search latency remained above 120ms.",
      server: "Search MCP",
      timestamp: 1713124740000,
    },
  ],
  timeseries: [
    { timestamp: 1713124500000, requests: 72, failures: 2, averageLatencyMs: 82 },
    { timestamp: 1713124560000, requests: 88, failures: 3, averageLatencyMs: 86 },
    { timestamp: 1713124620000, requests: 94, failures: 4, averageLatencyMs: 91 },
    { timestamp: 1713124680000, requests: 116, failures: 5, averageLatencyMs: 93 },
    { timestamp: 1713124740000, requests: 128, failures: 7, averageLatencyMs: 94 },
  ],
};

const blaxelFunctions: BlaxelFunctionRecord[] = [
  {
    name: "atlas-search",
    displayName: "Atlas Search",
    transport: "sse",
    url: "https://atlas.example/search",
    enabled: true,
    status: "online",
  },
  {
    name: "atlas-memory",
    displayName: "Atlas Memory",
    transport: "sse",
    url: "https://atlas.example/memory",
    enabled: true,
    status: "online",
  },
  {
    name: "atlas-sandbox",
    displayName: "Atlas Sandbox",
    transport: "http",
    url: null,
    enabled: false,
    status: "offline",
  },
];

describe("OverviewSummary", () => {
  it("renders the executive summary sections, quick links, registry coverage, and dashboard grid contract", () => {
    const { container } = render(
      <MemoryRouter>
        <OverviewSummary
          snapshot={snapshot}
          graphElements={buildTopologyElements(snapshot)}
          blaxelFunctions={blaxelFunctions}
          functionTestState={{}}
          functionTools={{}}
          functionToolState={{}}
          onTestFunction={() => {}}
          onLoadTools={() => {}}
        />
      </MemoryRouter>,
    );

    const overviewGrid = container.querySelector(".overview-summary.dashboard-grid");
    expect(overviewGrid).not.toBeNull();
    expect(overviewGrid?.querySelector(".panel.panel-full.summary-hero")).not.toBeNull();
    expect(overviewGrid?.querySelector(".panel.panel-wide.summary-panel-dark")).not.toBeNull();

    expect(screen.getByRole("heading", { name: /executive summary/i })).toBeInTheDocument();
    expect(screen.getByText("Active Servers")).toBeInTheDocument();
    expect(screen.getByText("Requests / Min")).toBeInTheDocument();
    expect(screen.getByText("Avg Latency")).toBeInTheDocument();
    expect(screen.getByText("Failed Requests")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /active anomalies/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /traffic pulse/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /topology preview/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /latest trace/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /registry coverage/i })).toBeInTheDocument();
    expect(screen.getByText(/3 blaxel functions/i)).toBeInTheDocument();

    const quickLinks = screen.getByRole("navigation", { name: /quick links/i });
    expect(within(quickLinks).getByRole("link", { name: /topology/i })).toHaveAttribute("href", "/topology");
    expect(within(quickLinks).getByRole("link", { name: /logs/i })).toHaveAttribute("href", "/logs");
    expect(within(quickLinks).getByRole("link", { name: /health/i })).toHaveAttribute("href", "/health");

    expect(screen.getAllByText("req-001").length).toBeGreaterThan(0);
    expect(screen.getByText(/memory timeout spike/i)).toBeInTheDocument();
  });
});
