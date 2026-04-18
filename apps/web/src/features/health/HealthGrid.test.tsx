import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { HealthGrid } from "./HealthGrid";

const snapshot: DashboardSnapshot = {
  generatedAt: 1713124800000,
  overview: {
    totalServers: 3,
    activeServers: 3,
    requestsLastMinute: 96,
    averageLatencyMs: 88,
    failedRequests: 3,
    anomalyCount: 1,
  },
  servers: [
    {
      name: "Gateway MCP",
      status: "online",
      heartbeatAt: 1713124800000,
      requestsPerMinute: 96,
      averageLatencyMs: 44,
      p95LatencyMs: 61,
      errorRate: 0.01,
      throughput: 12,
      inFlight: 1,
    },
    {
      name: "Search MCP",
      status: "online",
      heartbeatAt: 1713124800000,
      requestsPerMinute: 51,
      averageLatencyMs: 92,
      p95LatencyMs: 121,
      errorRate: 0.03,
      throughput: 7,
      inFlight: 1,
    },
    {
      name: "Memory MCP",
      status: "degraded",
      heartbeatAt: 1713124740000,
      requestsPerMinute: 18,
      averageLatencyMs: 127,
      p95LatencyMs: 184,
      errorRate: 0.08,
      throughput: 4,
      inFlight: 0,
    },
  ],
  toolsets: [],
  traces: [],
  dependencies: [],
  alerts: [
    {
      id: "alert-1",
      severity: "medium",
      kind: "latency",
      title: "Memory MCP latency rising",
      detail: "P95 latency is above the expected threshold.",
      server: "Memory MCP",
      timestamp: 1713124800000,
    },
  ],
  timeseries: [
    { timestamp: 1713124500000, requests: 64, failures: 1, averageLatencyMs: 78 },
    { timestamp: 1713124560000, requests: 72, failures: 1, averageLatencyMs: 80 },
    { timestamp: 1713124620000, requests: 84, failures: 2, averageLatencyMs: 84 },
    { timestamp: 1713124680000, requests: 91, failures: 2, averageLatencyMs: 86 },
    { timestamp: 1713124740000, requests: 96, failures: 3, averageLatencyMs: 88 },
  ],
};

describe("HealthGrid", () => {
  beforeAll(() => {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(min-width: 1024px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders the health panels and makes them desktop-resizable", () => {
    render(<HealthGrid snapshot={snapshot} />);

    expect(screen.getByRole("heading", { name: /server health/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /latency/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /failures/i })).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-health-table")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-health-latency")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-health-failures")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/resize .* width and height/i)).toHaveLength(3);
  });
});
