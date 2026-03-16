import CytoscapeComponent from "react-cytoscapejs";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { io } from "socket.io-client";
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
import type { BlaxelFunctionRecord, BlaxelToolRecord, DashboardSnapshot, TraceSummary } from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

const socket = io(apiBase || undefined, {
  autoConnect: false,
});

const clusterMap: Record<string, string> = {
  "Gateway MCP": "Entry Cluster",
  "Search MCP": "Retrieval Cluster",
  "Memory MCP": "Context Cluster",
  "File MCP": "Files Cluster",
  "Atlas Blaxel MCP": "Sandbox Cluster",
};

const clusterPositions: Record<string, { x: number; y: number }> = {
  "Gateway MCP": { x: 450, y: 120 },
  "Search MCP": { x: 160, y: 310 },
  "Memory MCP": { x: 760, y: 340 },
  "File MCP": { x: 450, y: 530 },
  "Atlas Blaxel MCP": { x: 760, y: 120 },
};

type GraphElement = {
  data: Record<string, string | number | null>;
  classes?: string;
  position?: { x: number; y: number };
};

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return `${seconds}s ago`;
}

function formatDateForFile(timestamp: number) {
  return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.startsWith("<!DOCTYPE") ? "API returned HTML instead of JSON. Make sure the Atlas server is running on port 4000 and restart the Vite frontend." : text || "Invalid JSON response");
  }
}

function scaleEdgeWeight(volume: number) {
  return Math.min(8, Math.max(2.2, 1.5 + Math.sqrt(volume) * 0.72));
}

function formatToolLabel(toolName: string) {
  const spaced = toolName
    .replace(/^codegen/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

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

function buildTopologyElements(snapshot: DashboardSnapshot) {
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
    const visibleTools = toolset.tools
      .slice()
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 4);
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

function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [blaxelFunctions, setBlaxelFunctions] = useState<BlaxelFunctionRecord[]>([]);
  const [functionTestState, setFunctionTestState] = useState<Record<string, string>>({});
  const [functionTools, setFunctionTools] = useState<Record<string, BlaxelToolRecord[]>>({});
  const [functionToolState, setFunctionToolState] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<{ pending: boolean; message: string | null }>({
    pending: false,
    message: null,
  });

  useEffect(() => {
    async function loadSnapshot() {
      const response = await fetch(`${apiBase}/api/snapshot`);
      const nextSnapshot = await readJsonResponse<DashboardSnapshot>(response);
      setSnapshot(nextSnapshot);
      setSelectedTraceId((current) => current ?? nextSnapshot.traces[0]?.traceId ?? null);
    }

    async function loadBlaxelFunctions() {
      const response = await fetch(`${apiBase}/api/integrations/blaxel/functions`);
      const payload = await readJsonResponse<{ ok: boolean; functions?: BlaxelFunctionRecord[] }>(response);
      if (payload.ok && payload.functions) {
        setBlaxelFunctions(payload.functions);
      }
    }

    loadSnapshot().catch((error) => console.error("Failed to load snapshot", error));
    loadBlaxelFunctions().catch((error) => console.error("Failed to load Blaxel functions", error));

    socket.connect();
    socket.on("dashboard:snapshot", (nextSnapshot: DashboardSnapshot) => {
      setSnapshot(nextSnapshot);
      setSelectedTraceId((current) => {
        if (current && nextSnapshot.traces.some((trace) => trace.traceId === current)) {
          return current;
        }
        return nextSnapshot.traces[0]?.traceId ?? null;
      });
    });

    return () => {
      socket.off("dashboard:snapshot");
      socket.disconnect();
    };
  }, []);

  const selectedTrace = snapshot?.traces.find((trace) => trace.traceId === selectedTraceId) ?? null;
  const graphElements = useMemo(() => {
    if (!snapshot) {
      return { flat: [], clustered: [] };
    }
    return buildTopologyElements(snapshot);
  }, [snapshot]);

  async function runRequest(path: string, body: unknown, successLabel: string) {
    setActionState({ pending: true, message: null });
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await readJsonResponse<{ traceId?: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      setActionState({
        pending: false,
        message: payload.traceId ? `${successLabel} trace: ${payload.traceId}` : successLabel,
      });
    } catch (error) {
      setActionState({
        pending: false,
        message: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  async function testBlaxelFunction(functionName: string) {
    setFunctionTestState((current) => ({ ...current, [functionName]: "Testing..." }));
    try {
      const response = await fetch(`${apiBase}/api/integrations/blaxel/functions/${functionName}/test`);
      const payload = await readJsonResponse<{ ok: boolean; toolCount?: number; error?: string }>(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Function test failed");
      }
      setFunctionTestState((current) => ({ ...current, [functionName]: `${payload.toolCount ?? 0} tools reachable` }));
    } catch (error) {
      setFunctionTestState((current) => ({
        ...current,
        [functionName]: error instanceof Error ? error.message : "Function test failed",
      }));
    }
  }

  async function loadBlaxelTools(functionName: string) {
    setFunctionToolState((current) => ({ ...current, [functionName]: "Loading tools..." }));
    try {
      const response = await fetch(`${apiBase}/api/integrations/blaxel/functions/${functionName}/tools`);
      const payload = await readJsonResponse<{ ok: boolean; tools?: BlaxelToolRecord[]; error?: string }>(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Tool discovery failed");
      }
      setFunctionTools((current) => ({ ...current, [functionName]: payload.tools ?? [] }));
      setFunctionToolState((current) => ({
        ...current,
        [functionName]: payload.tools?.length ? `${payload.tools.length} tools loaded` : "No tools exposed",
      }));
    } catch (error) {
      setFunctionToolState((current) => ({
        ...current,
        [functionName]: error instanceof Error ? error.message : "Tool discovery failed",
      }));
    }
  }

  async function runBlaxelSandboxTask() {
    await runRequest(
      "/api/integrations/blaxel/mcp/demo/processes-list",
      {},
      "Blaxel sandbox MCP trace completed",
    );
  }

  if (!snapshot) {
    return <div className="loading-shell">Loading MCP Atlas...</div>;
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Observability & Alignment Dashboard</p>
          <h1>MCP Atlas</h1>
          <p className="hero-copy">
            Real-time view of request paths, MCP dependencies, server health, and risky routing patterns.
          </p>
        </div>
        <div className="hero-meta">
          <span className="live-dot" />
          <span>Live snapshot {formatTime(snapshot.generatedAt)}</span>
        </div>
      </header>

      <nav className="nav-bar" aria-label="Primary navigation">
        <NavItem to="/" label="Overview" />
        <NavItem to="/topology" label="Topology" />
        <NavItem to="/health" label="Health" />
        <NavItem to="/logs" label="Logs" />
      </nav>

      <section className="metric-grid">
        <MetricCard label="Active Servers" value={`${snapshot.overview.activeServers}/${snapshot.overview.totalServers}`} />
        <MetricCard label="Requests / Min" value={String(snapshot.overview.requestsLastMinute)} />
        <MetricCard label="Avg Latency" value={`${snapshot.overview.averageLatencyMs}ms`} />
        <MetricCard label="Anomalies" value={String(snapshot.overview.anomalyCount)} />
      </section>

      <ActionBar
        pending={actionState.pending}
        message={actionState.message}
        onRunAgentTask={() => runRequest("/api/demo/agent-task", { query: "multi mcp observability" }, "Agent task completed")}
        onRunSearch={() => runRequest("/proxy/search-mcp", { query: "alignment dashboard" }, "Search MCP called")}
        onRunFailure={() => runRequest("/api/demo/agent-task", { query: "failing file path", forceFileFailure: true }, "Failure scenario triggered")}
        onRunBlaxelTask={runBlaxelSandboxTask}
      />

      <Routes>
        <Route
          path="/"
          element={
            <OverviewPage
              snapshot={snapshot}
              topologyElements={graphElements.flat}
              blaxelFunctions={blaxelFunctions}
              functionTestState={functionTestState}
              functionTools={functionTools}
              functionToolState={functionToolState}
              onTestFunction={testBlaxelFunction}
              onLoadTools={loadBlaxelTools}
            />
          }
        />
        <Route path="/topology" element={<TopologyPage snapshot={snapshot} graphElements={graphElements} />} />
        <Route path="/health" element={<HealthPage snapshot={snapshot} />} />
        <Route
          path="/logs"
          element={
            <LogsPage
              traces={snapshot.traces}
              selectedTrace={selectedTrace}
              selectedTraceId={selectedTraceId}
              onSelectTrace={setSelectedTraceId}
            />
          }
        />
      </Routes>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
      {label}
    </NavLink>
  );
}

function ActionBar({
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
      <p className="action-message">
        {pending
          ? "Running live request..."
          : message ?? "Ready for live traffic."}
      </p>
    </section>
  );
}

function OverviewPage({
  snapshot,
  topologyElements,
  blaxelFunctions,
  functionTestState,
  functionTools,
  functionToolState,
  onTestFunction,
  onLoadTools,
}: {
  snapshot: DashboardSnapshot;
  topologyElements: GraphElement[];
  blaxelFunctions: BlaxelFunctionRecord[];
  functionTestState: Record<string, string>;
  functionTools: Record<string, BlaxelToolRecord[]>;
  functionToolState: Record<string, string>;
  onTestFunction: (functionName: string) => void;
  onLoadTools: (functionName: string) => void;
}) {
  return (
    <section className="dashboard-grid">
      <article className="panel panel-full anomaly-summary-panel">
        <div className="panel-header">
          <div>
            <h2>Anomalies Detected</h2>
            <p>Latest live issues surfaced from proxy traffic, latency spikes, and failures.</p>
          </div>
          <span className={`status-pill ${snapshot.alerts.length > 0 ? "status-failed" : "status-online"}`}>
            {snapshot.alerts.length > 0 ? `${snapshot.alerts.length} active` : "clear"}
          </span>
        </div>
        <div className="anomaly-summary-list">
          {snapshot.alerts.length === 0 ? (
            <p className="empty">No anomalies detected in the recent telemetry window.</p>
          ) : (
            snapshot.alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className={`anomaly-pill severity-${alert.severity}`}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Traffic Trends</h2>
            <p>Rolling five-second buckets from the last minute.</p>
          </div>
        </div>
        <TrafficChart timeseries={snapshot.timeseries} />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Alignment Insights</h2>
            <p>Detected instability and risky request behavior.</p>
          </div>
        </div>
        <AlertList alerts={snapshot.alerts} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Blaxel MCP Registry</h2>
            <p>Workspace-discovered MCP servers from Blaxel with backend-side connection testing.</p>
          </div>
        </div>
        <div className="registry-list">
          {blaxelFunctions.length === 0 ? (
            <p className="empty">No deployed Blaxel MCP servers were discovered in workspace dk09.</p>
          ) : (
            blaxelFunctions.map((item) => (
              <div key={item.name} className="registry-card">
                <div className="registry-top">
                  <strong>{item.displayName}</strong>
                  <span className={`status-pill ${item.enabled ? "status-online" : "status-offline"}`}>{item.status}</span>
                </div>
                <p>{item.transport} {item.url ? `- ${item.url}` : ""}</p>
                <div className="registry-actions">
                  <button type="button" className="action-button" onClick={() => onTestFunction(item.name)}>
                    Test Connection
                  </button>
                  <button type="button" className="action-button action-button-secondary" onClick={() => onLoadTools(item.name)}>
                    Load Tools
                  </button>
                  <span className="registry-status">{functionTestState[item.name] ?? "Not tested yet"}</span>
                </div>
                <p className="registry-status">{functionToolState[item.name] ?? "No tool metadata loaded."}</p>
                {functionTools[item.name]?.length ? (
                  <div className="registry-tools">
                    {functionTools[item.name].map((tool) => (
                      <span key={`${item.name}-${tool.name}`} className="registry-tool-pill" title={tool.description}>
                        {tool.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Topology Snapshot</h2>
            <p>Current network structure, traffic flow, and attached tool capabilities for each MCP.</p>
          </div>
        </div>
        <TopologyGraph topologyElements={topologyElements} />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Latest Trace</h2>
            <p>Most recent request flow entering the system.</p>
          </div>
        </div>
        {snapshot.traces[0] ? <TraceDetail trace={snapshot.traces[0]} /> : <p className="empty">No traces available.</p>}
      </article>
    </section>
  );
}

function TopologyPage({
  snapshot,
  graphElements,
}: {
  snapshot: DashboardSnapshot;
  graphElements: { flat: GraphElement[]; clustered: GraphElement[] };
}) {
  const [showClusters, setShowClusters] = useState(false);

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>MCP Topology Graph</h2>
            <p>Directed edges stay readable, cluster mode groups servers by role, and tool leaf nodes show exposed capabilities.</p>
          </div>
          <button
            type="button"
            className={`view-toggle ${showClusters ? "view-toggle-active" : ""}`}
            onClick={() => setShowClusters((current) => !current)}
          >
            Clusters
          </button>
        </div>
        <TopologyGraph topologyElements={showClusters ? graphElements.clustered : graphElements.flat} tall clustered={showClusters} />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Dependency Edges</h2>
            <p>Most active connections in the last minute.</p>
          </div>
        </div>
        <div className="edge-list">
          {snapshot.dependencies.map((edge) => (
            <div key={`${edge.source}-${edge.target}`} className="edge-card">
              <strong>
                {edge.source} -&gt; {edge.target}
              </strong>
              <div className="trace-meta">
                <span>{edge.volume} req</span>
                <span>{edge.averageLatencyMs}ms avg</span>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Alignment Insights</h2>
            <p>Network-level anomalies surfaced from dependency and trace patterns.</p>
          </div>
        </div>
        <AlertList alerts={snapshot.alerts} />
      </article>
    </section>
  );
}

function HealthPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Server Health</h2>
            <p>Heartbeat, throughput, latency, and failure rate per MCP server.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Status</th>
                <th>Heartbeat</th>
                <th>Req/Min</th>
                <th>Avg Latency</th>
                <th>P95</th>
                <th>Failure Rate</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.servers.map((server) => (
                <tr key={server.name}>
                  <td>{server.name}</td>
                  <td>
                    <span className={`status-pill status-${server.status}`}>{server.status}</span>
                  </td>
                  <td>{server.heartbeatAt ? relativeTime(server.heartbeatAt) : "none"}</td>
                  <td>{server.requestsPerMinute}</td>
                  <td>{server.averageLatencyMs}ms</td>
                  <td>{server.p95LatencyMs}ms</td>
                  <td>{Math.round(server.errorRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Latency</h2>
            <p>Average latency trend over the last minute.</p>
          </div>
        </div>
        <LatencyChart timeseries={snapshot.timeseries} />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Failures</h2>
            <p>Servers with the highest recent failure pressure.</p>
          </div>
        </div>
        <div className="alerts">
          {snapshot.servers
            .slice()
            .sort((a, b) => b.errorRate - a.errorRate)
            .map((server) => (
              <div key={server.name} className="alert-card">
                <div className="alert-title-row">
                  <strong>{server.name}</strong>
                  <span>{Math.round(server.errorRate * 100)}%</span>
                </div>
                <p>
                  {server.requestsPerMinute} requests/min, p95 {server.p95LatencyMs}ms.
                </p>
              </div>
            ))}
        </div>
      </article>
    </section>
  );
}

function LogsPage({
  traces,
  selectedTrace,
  selectedTraceId,
  onSelectTrace,
}: {
  traces: DashboardSnapshot["traces"];
  selectedTrace: TraceSummary | null;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string) => void;
}) {
  function exportTrace(trace: TraceSummary) {
    const headers = [
      "trace_id",
      "request_id",
      "origin",
      "trace_status",
      "hop_index",
      "event_type",
      "source",
      "target",
      "hop_status",
      "latency_ms",
      "timestamp",
      "error_message",
      "path",
    ];

    const rows = trace.hops.map((hop, index) => [
      trace.traceId,
      trace.requestId,
      trace.origin,
      trace.status,
      String(index + 1),
      hop.eventType,
      hop.source,
      hop.target ?? "",
      hop.status,
      String(hop.latencyMs),
      new Date(hop.timestamp).toISOString(),
      hop.errorMessage ?? "",
      trace.path.join(" -> "),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${trace.requestId}-${formatDateForFile(trace.updatedAt)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Request Logs</h2>
            <p>Recent traces reconstructed from MCP telemetry events.</p>
          </div>
        </div>
        <div className="trace-list">
          {traces.map((trace) => (
            <button
              key={trace.traceId}
              className={`trace-card ${trace.traceId === selectedTraceId ? "trace-card-active" : ""}`}
              onClick={() => onSelectTrace(trace.traceId)}
              type="button"
            >
              <div className="trace-top">
                <strong>{trace.requestId}</strong>
                <span className={`status-pill status-${trace.status}`}>{trace.status}</span>
              </div>
              <p>{trace.path.join(" -> ")}</p>
              <div className="trace-meta">
                <span>{trace.totalLatencyMs}ms total</span>
                <span>{formatTime(trace.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Trace Detail</h2>
            <p>Hop-by-hop lifecycle of the selected request.</p>
          </div>
          {selectedTrace ? (
            <button type="button" className="action-button export-button" onClick={() => exportTrace(selectedTrace)}>
              Export Excel CSV
            </button>
          ) : null}
        </div>
        {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">Select a trace to inspect it.</p>}
      </article>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrafficChart({ timeseries }: { timeseries: DashboardSnapshot["timeseries"] }) {
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

function LatencyChart({ timeseries }: { timeseries: DashboardSnapshot["timeseries"] }) {
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

function AlertList({ alerts }: { alerts: DashboardSnapshot["alerts"] }) {
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

function TopologyGraph({
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

function TraceDetail({ trace }: { trace: TraceSummary }) {
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

export default App;
