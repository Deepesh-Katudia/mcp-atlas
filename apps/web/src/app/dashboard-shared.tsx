import CytoscapeComponent from "react-cytoscapejs";
import { useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";

const clusterPositions: Record<string, { x: number; y: number }> = {
  "Gateway MCP": { x: 450, y: 120 },
  "Search MCP": { x: 160, y: 310 },
  "Memory MCP": { x: 760, y: 340 },
  "File MCP": { x: 450, y: 530 },
  "Atlas Blaxel MCP": { x: 760, y: 120 },
};

export type GraphElement = {
  data: Record<string, string | number | null>;
  classes?: string;
  position?: { x: number; y: number };
};

export type GraphElementsBundle = {
  flat: GraphElement[];
  clustered: GraphElement[];
};

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return `${seconds}s ago`;
}

export function formatDateForFile(timestamp: number) {
  return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}

function scaleEdgeWeight(volume: number) {
  return Math.min(8, Math.max(2.2, 1.5 + Math.sqrt(volume) * 0.72));
}

function formatToolLabel(toolName: string) {
  const spaced = toolName.replace(/^codegen/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return words[0] ?? toolName;
  }

  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

function toolClusterPosition(server: string, index: number, total: number) {
  const base = clusterPositions[server];
  if (!base) {
    return undefined;
  }

  const radius = total > 3 ? 120 : 104;
  const angleStep = (Math.PI * 2) / Math.max(total, 1);
  const angle = -Math.PI / 2 + index * angleStep;

  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + Math.sin(angle) * radius,
  };
}

export function buildTopologyElements(snapshot: DashboardSnapshot): GraphElementsBundle {
  const flatNodes: GraphElement[] = snapshot.servers.map((server) => ({
    data: {
      id: server.name,
      label: server.name,
      status: server.status,
      kind: "mcp",
      clusterX: clusterPositions[server.name]?.x ?? null,
      clusterY: clusterPositions[server.name]?.y ?? null,
    },
  }));

  const flatEdges: GraphElement[] = snapshot.dependencies.map((edge) => ({
    data: {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: `${edge.volume} req`,
      weight: scaleEdgeWeight(edge.volume),
      volume: edge.volume,
    },
  }));

  const toolNodes: GraphElement[] = [];
  const toolEdges: GraphElement[] = [];

  snapshot.toolsets.forEach((toolset) => {
    const visibleTools = toolset.tools.slice().sort((a, b) => b.requestCount - a.requestCount).slice(0, 4);
    visibleTools.forEach((tool, index) => {
      const nodeId = `${toolset.server}::${tool.id}`;
      const clusterPosition = toolClusterPosition(toolset.server, index, visibleTools.length);

      toolNodes.push({
        data: {
          id: nodeId,
          label: formatToolLabel(tool.name),
          kind: "tool",
          status: null,
          clusterX: clusterPosition?.x ?? null,
          clusterY: clusterPosition?.y ?? null,
          description: tool.description ?? "",
          parentServer: toolset.server,
        },
        position: clusterPosition,
      });

      toolEdges.push({
        data: {
          id: `${toolset.server}->${nodeId}`,
          source: nodeId,
          target: toolset.server,
          label: tool.requestCount > 0 ? `${tool.requestCount} req\n${tool.averageLatencyMs}ms` : "0 req",
          weight: tool.requestCount > 0 ? Math.min(4.2, 1.6 + Math.sqrt(tool.requestCount) * 0.5) : 1.6,
          volume: tool.requestCount,
        },
        classes: "tool-edge",
      });
    });
  });

  return {
    flat: [...flatNodes, ...toolNodes, ...flatEdges, ...toolEdges],
    clustered: [...flatNodes, ...toolNodes, ...flatEdges, ...toolEdges],
  };
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ActionBar({
  pending,
  message,
  onRunAgentTask,
  onRunSearch,
  onRunFailure,
  onRunBlaxelTask,
}: {
  pending: boolean;
  message: string | null;
  onRunAgentTask: () => void;
  onRunSearch: () => void;
  onRunFailure: () => void;
  onRunBlaxelTask: () => void;
}) {
  return (
    <section className="action-bar">
      <div>
        <p className="eyebrow action-eyebrow">Live Traffic Controls</p>
        <strong>Trigger real local or Blaxel sandbox MCP traffic through the Atlas proxy.</strong>
      </div>
      <div className="action-buttons">
        <button type="button" className="action-button" onClick={onRunAgentTask} disabled={pending}>
          Run Agent Task
        </button>
        <button type="button" className="action-button" onClick={onRunSearch} disabled={pending}>
          Call Search MCP
        </button>
        <button type="button" className="action-button" onClick={onRunBlaxelTask} disabled={pending}>
          Run Blaxel Sandbox MCP
        </button>
        <button type="button" className="action-button action-button-danger" onClick={onRunFailure} disabled={pending}>
          Trigger Failure
        </button>
      </div>
      <p className="action-message">{pending ? "Running live request..." : message ?? "Ready for live traffic."}</p>
    </section>
  );
}

export function TrafficChart({ timeseries }: { timeseries: DashboardSnapshot["timeseries"] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={timeseries}>
          <defs>
            <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
          <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(value).slice(0, 8)} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(value) => formatTime(Number(value))}
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #2b3442" }}
          />
          <Area type="monotone" dataKey="requests" stroke="#fb7185" fill="url(#requestsFill)" />
          <Line type="monotone" dataKey="failures" stroke="#facc15" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LatencyChart({ timeseries }: { timeseries: DashboardSnapshot["timeseries"] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={timeseries}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
          <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(value).slice(0, 8)} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(value) => formatTime(Number(value))}
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #2b3442" }}
          />
          <Line type="monotone" dataKey="averageLatencyMs" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AlertList({ alerts }: { alerts: DashboardSnapshot["alerts"] }) {
  return (
    <div className="alerts">
      {alerts.length === 0 ? (
        <p className="empty">No anomalies detected in the recent telemetry window.</p>
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className={`alert-card severity-${alert.severity}`}>
            <div className="alert-title-row">
              <strong>{alert.title}</strong>
              <span>{formatTime(alert.timestamp)}</span>
            </div>
            <p>{alert.detail}</p>
          </div>
        ))
      )}
    </div>
  );
}

export function TopologyGraph({
  topologyElements,
  tall = false,
  clustered = false,
}: {
  topologyElements: GraphElement[];
  tall?: boolean;
  clustered?: boolean;
}) {
  const cyRef = useRef<any>(null);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    if (clustered) {
      cy.nodes().forEach((node: any) => {
        const clusterX = node.data("clusterX");
        const clusterY = node.data("clusterY");
        if (typeof clusterX === "number" && typeof clusterY === "number") {
          node.animate(
            {
              position: { x: clusterX, y: clusterY },
            },
            {
              duration: 560,
              easing: "ease-in-out-cubic",
            },
          );
        }
      });

      const fitTimer = window.setTimeout(() => {
        cy.fit(cy.elements(), 54);
      }, 580);

      return () => window.clearTimeout(fitTimer);
    }

    cy.layout({
      name: "breadthfirst",
      directed: true,
      roots: ["Gateway MCP"],
      spacingFactor: 1.28,
      padding: 30,
      animate: true,
      animationDuration: 560,
      fit: true,
    }).run();
  }, [clustered, topologyElements]);

  return (
    <div className={`graph-wrap ${tall ? "graph-wrap-tall" : ""}`}>
      <CytoscapeComponent
        className="graph-canvas"
        elements={topologyElements}
        style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
        layout={
          clustered
            ? {
                name: "preset",
                padding: 24,
              }
            : {
                name: "breadthfirst",
                directed: true,
                roots: ["Gateway MCP"],
                spacingFactor: 1.28,
                padding: 30,
                animate: true,
                animationDuration: 560,
              }
        }
        stylesheet={[
          {
            selector: "node",
            style: {
              label: "data(label)",
              color: "#f8fafc",
              "font-size": "11px",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#64748b",
              width: 60,
              height: 60,
              "border-width": 3,
              "border-color": "#e2e8f0",
              "text-wrap": "wrap",
              "text-max-width": "54px",
            },
          },
          {
            selector: 'node[kind = "tool"]',
            style: {
              shape: "ellipse",
              width: 82,
              height: 82,
              "font-size": "8px",
              "background-color": "#143454",
              "border-width": 2,
              "border-color": "#67e8f9",
              color: "#e7fcff",
              "text-max-width": "68px",
              "text-wrap": "wrap",
              "text-valign": "center",
              "text-halign": "center",
              "line-height": 1.15,
            },
          },
          {
            selector: 'node[status = "online"]',
            style: { "background-color": "#10b981" },
          },
          {
            selector: 'node[status = "degraded"]',
            style: { "background-color": "#f59e0b" },
          },
          {
            selector: 'node[status = "offline"]',
            style: { "background-color": "#ef4444" },
          },
          {
            selector: "edge",
            style: {
              label: "data(label)",
              "curve-style": "bezier",
              width: "data(weight)",
              "line-color": "#fb7185",
              opacity: 0.92,
              "target-arrow-color": "#fb7185",
              "target-arrow-shape": "triangle",
              "arrow-scale": 1.5,
              "source-endpoint": "outside-to-node",
              "target-endpoint": "outside-to-node",
              color: "#f8fafc",
              "font-size": "9px",
              "text-background-color": "#0f172a",
              "text-background-opacity": 0.88,
              "text-background-padding": "2px",
              "text-rotation": "autorotate",
              "text-margin-y": "-8px",
            },
          },
          {
            selector: "edge.tool-edge",
            style: {
              width: "data(weight)",
              "line-style": "solid",
              "line-color": "#7dd3fc",
              "target-arrow-shape": "triangle",
              "target-arrow-color": "#7dd3fc",
              "arrow-scale": 1.05,
              opacity: 0.95,
              label: "data(label)",
              "font-size": "8px",
              color: "#dff7ff",
              "text-background-color": "#10243d",
              "text-background-opacity": 0.92,
              "text-background-padding": "2px",
              "text-rotation": "autorotate",
              "text-margin-y": "-6px",
            },
          },
        ]}
        cy={(cy: any) => {
          cyRef.current = cy;
        }}
      />
      {clustered ? (
        <div className="cluster-overlay" aria-hidden="true">
          <div className="cluster-ring cluster-ring-entry">
            <span>Entry Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-retrieval">
            <span>Retrieval Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-context">
            <span>Context Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-files">
            <span>Files Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-sandbox">
            <span>Sandbox Cluster</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TraceDetail({ trace }: { trace: TraceSummary }) {
  return (
    <div className="trace-detail">
      <div className="trace-banner">
        <div>
          <strong>{trace.requestId}</strong>
          <p>{trace.path.join(" -> ")}</p>
        </div>
        <span className={`status-pill status-${trace.status}`}>{trace.status}</span>
      </div>
      <div className="hop-list">
        {trace.hops.map((hop, index) => (
          <div key={`${trace.traceId}-${index}`} className="hop-card">
            <div className="hop-header">
              <strong>{hop.eventType}</strong>
              <span>{formatTime(hop.timestamp)}</span>
            </div>
            <p>
              {hop.source}
              {hop.target ? ` -> ${hop.target}` : ""}
            </p>
            <div className="hop-meta">
              <span>{hop.latencyMs}ms</span>
              <span className={`event-${hop.status}`}>{hop.status}</span>
            </div>
            {hop.errorMessage ? <p className="hop-error">{hop.errorMessage}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
