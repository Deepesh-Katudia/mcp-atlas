import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { TraceSummary } from "@mcp-atlas/contracts";
import { LogsWorkspace } from "./LogsWorkspace";
import { exportTraceCsv } from "./export-trace-csv";

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

function LogsWorkspaceHarness() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(traces[0].traceId);
  const selectedTrace = traces.find((trace) => trace.traceId === selectedTraceId) ?? null;

  return (
    <LogsWorkspace
      traces={traces}
      selectedTraceId={selectedTraceId}
      selectedTrace={selectedTrace}
      onSelectTrace={setSelectedTraceId}
    />
  );
}

describe("LogsWorkspace", () => {
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

  it("renders the real two-pane logs flow with button-based trace selection, detail updates, and export in the detail header", () => {
    const { container } = render(<LogsWorkspaceHarness />);

    const workspace = container.querySelector(".logs-workspace.masonry-workspace");
    expect(workspace).not.toBeNull();
    expect(screen.getByTestId("masonry-card-logs-logs-list")).toBeInTheDocument();
    expect(screen.getByTestId("masonry-card-logs-logs-detail")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /request logs/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /trace detail/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /trace list/i })).toBeInTheDocument();

    const traceList = screen.getByRole("list", { name: /trace list/i });
    const firstTraceButton = within(traceList).getByRole("button", { name: /req-001/i });
    const secondTraceButton = within(traceList).getByRole("button", { name: /req-002/i });
    expect(firstTraceButton).toBeInTheDocument();
    expect(secondTraceButton).toBeInTheDocument();
    expect(firstTraceButton).not.toHaveAttribute("role");
    expect(secondTraceButton).not.toHaveAttribute("role");

    expect(screen.getByText("Trace trace-001")).toBeInTheDocument();
    expect(screen.getByText("REQUEST_COMPLETED")).toBeInTheDocument();

    const detailHeader = container.querySelector(".logs-workspace-detail .panel-header");
    expect(detailHeader).not.toBeNull();
    const exportButton = within(detailHeader as HTMLElement).getByRole("button", { name: /export excel csv/i });
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(secondTraceButton);

    expect(screen.getByText("Trace trace-002")).toBeInTheDocument();
    expect(screen.getByText("REQUEST_FAILED")).toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(exportTraceCsv).toHaveBeenCalledWith(traces[1]);
  });

  it("makes both logs panels desktop-resizable", () => {
    render(<LogsWorkspaceHarness />);

    expect(screen.getByTestId("resizable-panel-logs-list")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-logs-detail")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/resize .* width and height/i)).toHaveLength(2);
  });
});
