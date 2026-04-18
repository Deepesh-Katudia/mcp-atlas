import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TopologyPage } from "./TopologyPage";

const mockUseDashboardAppContext = vi.fn();
const mockTopologyGraph = vi.fn();

vi.mock("../app/App", () => ({
  useDashboardAppContext: () => mockUseDashboardAppContext(),
}));

vi.mock("../features/topology/TopologyGraph", () => ({
  TopologyGraph: (props: unknown) => {
    mockTopologyGraph(props);
    return <div data-testid="topology-graph" />;
  },
}));

describe("TopologyPage", () => {
  it("renders the topology page header, keeps clusters in the header area, and shows supporting cards around the graph", () => {
    mockTopologyGraph.mockClear();
    mockUseDashboardAppContext.mockReturnValue({
      snapshot: {
        dependencies: [
          {
            source: "Gateway MCP",
            target: "Search MCP",
            volume: 84,
            averageLatencyMs: 142,
          },
        ],
        alerts: [
          {
            id: "alert-1",
            timestamp: 1713124800000,
            severity: "medium",
            title: "Search MCP lag",
            detail: "Latency variance climbed across the retrieval route.",
          },
        ],
      },
      graphElements: {
        flat: [{ data: { id: "flat-node" } }],
        clustered: [{ data: { id: "clustered-node" } }],
      },
    });

    const { container } = render(<TopologyPage />);

    const pageHeader = container.querySelector(".page-header");
    expect(pageHeader).not.toBeNull();

    expect(screen.getByText("Dependency map")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /topology workspace/i })).toBeInTheDocument();
    expect(within(pageHeader as HTMLElement).getByRole("button", { name: /clusters/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /dependency edges/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /alignment insights/i })).toBeInTheDocument();
    expect(screen.getByText("Gateway MCP -> Search MCP")).toBeInTheDocument();
    expect(screen.getByText("Search MCP lag")).toBeInTheDocument();
    expect(mockTopologyGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        topologyElements: [{ data: { id: "flat-node" } }],
        clustered: false,
        tall: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /clusters/i }));

    expect(mockTopologyGraph).toHaveBeenLastCalledWith(
      expect.objectContaining({
        topologyElements: [{ data: { id: "clustered-node" } }],
        clustered: true,
        tall: true,
        resizeSignal: 0,
      }),
    );
  });

  it("wraps the topology graph and support cards in resizable panels while preserving cluster toggling", () => {
    mockTopologyGraph.mockClear();
    mockUseDashboardAppContext.mockReturnValue({
      snapshot: {
        dependencies: [
          {
            source: "Gateway MCP",
            target: "Search MCP",
            volume: 84,
            averageLatencyMs: 142,
          },
        ],
        alerts: [
          {
            id: "alert-1",
            timestamp: 1713124800000,
            severity: "medium",
            title: "Search MCP lag",
            detail: "Latency variance climbed across the retrieval route.",
          },
        ],
      },
      graphElements: {
        flat: [{ data: { id: "flat-node" } }],
        clustered: [{ data: { id: "clustered-node" } }],
      },
    });

    render(<TopologyPage />);

    expect(screen.getByTestId("resizable-panel-topology-graph")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-topology-edges")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-topology-insights")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clusters/i }));

    expect(mockTopologyGraph).toHaveBeenLastCalledWith(
      expect.objectContaining({
        topologyElements: [{ data: { id: "clustered-node" } }],
        clustered: true,
        resizeSignal: expect.any(Number),
      }),
    );
  });
});
