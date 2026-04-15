import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { TraceSummary } from "@mcp-atlas/contracts";
import { LogsWorkspace } from "./LogsWorkspace";

vi.mock("./TraceList", () => ({
  TraceList: ({
    traces,
    selectedTraceId,
    onSelectTrace,
  }: {
    traces: TraceSummary[];
    selectedTraceId: string | null;
    onSelectTrace: (traceId: string) => void;
  }) => (
    <div data-testid="trace-list">
      <div>{traces.length} traces</div>
      <button type="button" onClick={() => onSelectTrace(traces[1]?.traceId ?? traces[0]?.traceId ?? "")}>
        choose trace
      </button>
      <div>Selected: {selectedTraceId ?? "none"}</div>
    </div>
  ),
}));

vi.mock("./TraceDetail", () => ({
  TraceDetail: ({ trace }: { trace: TraceSummary }) => <div data-testid="trace-detail">Detail for {trace.requestId}</div>,
}));

vi.mock("./export-trace-csv", () => ({
  exportTraceCsv: vi.fn(),
}));

const traces: TraceSummary[] = [
  {
    traceId: "trace-001",
    requestId: "req-001",
    origin: "Gateway MCP",
    path: ["Gateway MCP", "Search MCP"],
    totalLatencyMs: 120,
    status: "success",
    startedAt: 1713124700000,
    updatedAt: 1713124800000,
    hops: [
      {
        source: "Gateway MCP",
        target: "Search MCP",
        latencyMs: 120,
        status: "ok",
        timestamp: 1713124800000,
        errorMessage: null,
        eventType: "REQUEST_COMPLETED",
      },
    ],
  },
  {
    traceId: "trace-002",
    requestId: "req-002",
    origin: "Gateway MCP",
    path: ["Gateway MCP", "Memory MCP"],
    totalLatencyMs: 240,
    status: "failed",
    startedAt: 1713124700000,
    updatedAt: 1713124860000,
    hops: [
      {
        source: "Gateway MCP",
        target: "Memory MCP",
        latencyMs: 240,
        status: "error",
        timestamp: 1713124860000,
        errorMessage: "timeout",
        eventType: "REQUEST_FAILED",
      },
    ],
  },
];

describe("LogsWorkspace", () => {
  it("renders a two-pane logs workspace with the export action in the detail header and a dark detail surface hook", () => {
    const onSelectTrace = vi.fn();
    const { container } = render(
      <LogsWorkspace traces={traces} selectedTraceId="trace-001" selectedTrace={traces[0]} onSelectTrace={onSelectTrace} />,
    );

    const workspace = container.querySelector(".logs-workspace.dashboard-grid");
    expect(workspace).not.toBeNull();
    expect(workspace?.querySelector(".logs-workspace-list")).not.toBeNull();
    expect(workspace?.querySelector(".logs-workspace-detail.logs-workspace-detail-dark")).not.toBeNull();

    expect(screen.getByRole("heading", { name: /request logs/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /trace detail/i })).toBeInTheDocument();
    expect(screen.getByTestId("trace-list")).toBeInTheDocument();
    expect(screen.getByTestId("trace-detail")).toBeInTheDocument();

    const detailHeader = container.querySelector(".logs-workspace-detail .panel-header");
    expect(detailHeader).not.toBeNull();
    expect(within(detailHeader as HTMLElement).getByRole("button", { name: /export excel csv/i })).toBeInTheDocument();
  });
});
