import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CytoscapeComponent from "react-cytoscapejs";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { io } from "socket.io-client";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const socket = io(apiBase || undefined, {
    autoConnect: false,
});
const clusterMap = {
    "Gateway MCP": "Entry Cluster",
    "Search MCP": "Retrieval Cluster",
    "Memory MCP": "Context Cluster",
    "File MCP": "Files Cluster",
    "Atlas Blaxel MCP": "Sandbox Cluster",
};
const clusterPositions = {
    "Gateway MCP": { x: 450, y: 120 },
    "Search MCP": { x: 160, y: 310 },
    "Memory MCP": { x: 760, y: 340 },
    "File MCP": { x: 450, y: 530 },
    "Atlas Blaxel MCP": { x: 760, y: 120 },
};
function formatTime(timestamp) {
    return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(timestamp);
}
function relativeTime(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    return `${seconds}s ago`;
}
function formatDateForFile(timestamp) {
    return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}
async function readJsonResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error(text.startsWith("<!DOCTYPE") ? "API returned HTML instead of JSON. Make sure the Atlas server is running on port 4000 and restart the Vite frontend." : text || "Invalid JSON response");
    }
}
function scaleEdgeWeight(volume) {
    return Math.min(8, Math.max(2.2, 1.5 + Math.sqrt(volume) * 0.72));
}
function formatToolLabel(toolName) {
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
function toolClusterPosition(server, index, total) {
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
function buildTopologyElements(snapshot) {
    const flatNodes = snapshot.servers.map((server) => ({
        data: {
            id: server.name,
            label: server.name,
            status: server.status,
            kind: "mcp",
            clusterX: clusterPositions[server.name]?.x ?? null,
            clusterY: clusterPositions[server.name]?.y ?? null,
        },
    }));
    const flatEdges = snapshot.dependencies.map((edge) => ({
        data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: `${edge.volume} req`,
            weight: scaleEdgeWeight(edge.volume),
            volume: edge.volume,
        },
    }));
    const toolNodes = [];
    const toolEdges = [];
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
    const [snapshot, setSnapshot] = useState(null);
    const [selectedTraceId, setSelectedTraceId] = useState(null);
    const [blaxelFunctions, setBlaxelFunctions] = useState([]);
    const [functionTestState, setFunctionTestState] = useState({});
    const [functionTools, setFunctionTools] = useState({});
    const [functionToolState, setFunctionToolState] = useState({});
    const [actionState, setActionState] = useState({
        pending: false,
        message: null,
    });
    useEffect(() => {
        async function loadSnapshot() {
            const response = await fetch(`${apiBase}/api/snapshot`);
            const nextSnapshot = await readJsonResponse(response);
            setSnapshot(nextSnapshot);
            setSelectedTraceId((current) => current ?? nextSnapshot.traces[0]?.traceId ?? null);
        }
        async function loadBlaxelFunctions() {
            const response = await fetch(`${apiBase}/api/integrations/blaxel/functions`);
            const payload = await readJsonResponse(response);
            if (payload.ok && payload.functions) {
                setBlaxelFunctions(payload.functions);
            }
        }
        loadSnapshot().catch((error) => console.error("Failed to load snapshot", error));
        loadBlaxelFunctions().catch((error) => console.error("Failed to load Blaxel functions", error));
        socket.connect();
        socket.on("dashboard:snapshot", (nextSnapshot) => {
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
    async function runRequest(path, body, successLabel) {
        setActionState({ pending: true, message: null });
        try {
            const response = await fetch(`${apiBase}${path}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            const payload = await readJsonResponse(response);
            if (!response.ok) {
                throw new Error(payload.error ?? "Request failed");
            }
            setActionState({
                pending: false,
                message: payload.traceId ? `${successLabel} trace: ${payload.traceId}` : successLabel,
            });
        }
        catch (error) {
            setActionState({
                pending: false,
                message: error instanceof Error ? error.message : "Request failed",
            });
        }
    }
    async function testBlaxelFunction(functionName) {
        setFunctionTestState((current) => ({ ...current, [functionName]: "Testing..." }));
        try {
            const response = await fetch(`${apiBase}/api/integrations/blaxel/functions/${functionName}/test`);
            const payload = await readJsonResponse(response);
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error ?? "Function test failed");
            }
            setFunctionTestState((current) => ({ ...current, [functionName]: `${payload.toolCount ?? 0} tools reachable` }));
        }
        catch (error) {
            setFunctionTestState((current) => ({
                ...current,
                [functionName]: error instanceof Error ? error.message : "Function test failed",
            }));
        }
    }
    async function loadBlaxelTools(functionName) {
        setFunctionToolState((current) => ({ ...current, [functionName]: "Loading tools..." }));
        try {
            const response = await fetch(`${apiBase}/api/integrations/blaxel/functions/${functionName}/tools`);
            const payload = await readJsonResponse(response);
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error ?? "Tool discovery failed");
            }
            setFunctionTools((current) => ({ ...current, [functionName]: payload.tools ?? [] }));
            setFunctionToolState((current) => ({
                ...current,
                [functionName]: payload.tools?.length ? `${payload.tools.length} tools loaded` : "No tools exposed",
            }));
        }
        catch (error) {
            setFunctionToolState((current) => ({
                ...current,
                [functionName]: error instanceof Error ? error.message : "Tool discovery failed",
            }));
        }
    }
    async function runBlaxelSandboxTask() {
        await runRequest("/api/integrations/blaxel/mcp/demo/processes-list", {}, "Blaxel sandbox MCP trace completed");
    }
    if (!snapshot) {
        return _jsx("div", { className: "loading-shell", children: "Loading MCP Atlas..." });
    }
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Observability & Alignment Dashboard" }), _jsx("h1", { children: "MCP Atlas" }), _jsx("p", { className: "hero-copy", children: "Real-time view of request paths, MCP dependencies, server health, and risky routing patterns." })] }), _jsxs("div", { className: "hero-meta", children: [_jsx("span", { className: "live-dot" }), _jsxs("span", { children: ["Live snapshot ", formatTime(snapshot.generatedAt)] })] })] }), _jsxs("nav", { className: "nav-bar", "aria-label": "Primary navigation", children: [_jsx(NavItem, { to: "/", label: "Overview" }), _jsx(NavItem, { to: "/topology", label: "Topology" }), _jsx(NavItem, { to: "/health", label: "Health" }), _jsx(NavItem, { to: "/logs", label: "Logs" })] }), _jsxs("section", { className: "metric-grid", children: [_jsx(MetricCard, { label: "Active Servers", value: `${snapshot.overview.activeServers}/${snapshot.overview.totalServers}` }), _jsx(MetricCard, { label: "Requests / Min", value: String(snapshot.overview.requestsLastMinute) }), _jsx(MetricCard, { label: "Avg Latency", value: `${snapshot.overview.averageLatencyMs}ms` }), _jsx(MetricCard, { label: "Anomalies", value: String(snapshot.overview.anomalyCount) })] }), _jsx(ActionBar, { pending: actionState.pending, message: actionState.message, onRunAgentTask: () => runRequest("/api/demo/agent-task", { query: "multi mcp observability" }, "Agent task completed"), onRunSearch: () => runRequest("/proxy/search-mcp", { query: "alignment dashboard" }, "Search MCP called"), onRunFailure: () => runRequest("/api/demo/agent-task", { query: "failing file path", forceFileFailure: true }, "Failure scenario triggered"), onRunBlaxelTask: runBlaxelSandboxTask }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(OverviewPage, { snapshot: snapshot, topologyElements: graphElements.flat, blaxelFunctions: blaxelFunctions, functionTestState: functionTestState, functionTools: functionTools, functionToolState: functionToolState, onTestFunction: testBlaxelFunction, onLoadTools: loadBlaxelTools }) }), _jsx(Route, { path: "/topology", element: _jsx(TopologyPage, { snapshot: snapshot, graphElements: graphElements }) }), _jsx(Route, { path: "/health", element: _jsx(HealthPage, { snapshot: snapshot }) }), _jsx(Route, { path: "/logs", element: _jsx(LogsPage, { traces: snapshot.traces, selectedTrace: selectedTrace, selectedTraceId: selectedTraceId, onSelectTrace: setSelectedTraceId }) })] })] }));
}
function NavItem({ to, label }) {
    return (_jsx(NavLink, { to: to, end: to === "/", className: ({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`, children: label }));
}
function ActionBar({ pending, message, onRunAgentTask, onRunSearch, onRunFailure, onRunBlaxelTask, }) {
    return (_jsxs("section", { className: "action-bar", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow action-eyebrow", children: "Live Traffic Controls" }), _jsx("strong", { children: "Trigger real local or Blaxel sandbox MCP traffic through the Atlas proxy." })] }), _jsxs("div", { className: "action-buttons", children: [_jsx("button", { type: "button", className: "action-button", onClick: onRunAgentTask, disabled: pending, children: "Run Agent Task" }), _jsx("button", { type: "button", className: "action-button", onClick: onRunSearch, disabled: pending, children: "Call Search MCP" }), _jsx("button", { type: "button", className: "action-button", onClick: onRunBlaxelTask, disabled: pending, children: "Run Blaxel Sandbox MCP" }), _jsx("button", { type: "button", className: "action-button action-button-danger", onClick: onRunFailure, disabled: pending, children: "Trigger Failure" })] }), _jsx("p", { className: "action-message", children: pending
                    ? "Running live request..."
                    : message ?? "Ready for live traffic." })] }));
}
function OverviewPage({ snapshot, topologyElements, blaxelFunctions, functionTestState, functionTools, functionToolState, onTestFunction, onLoadTools, }) {
    return (_jsxs("section", { className: "dashboard-grid", children: [_jsxs("article", { className: "panel panel-full anomaly-summary-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Anomalies Detected" }), _jsx("p", { children: "Latest live issues surfaced from proxy traffic, latency spikes, and failures." })] }), _jsx("span", { className: `status-pill ${snapshot.alerts.length > 0 ? "status-failed" : "status-online"}`, children: snapshot.alerts.length > 0 ? `${snapshot.alerts.length} active` : "clear" })] }), _jsx("div", { className: "anomaly-summary-list", children: snapshot.alerts.length === 0 ? (_jsx("p", { className: "empty", children: "No anomalies detected in the recent telemetry window." })) : (snapshot.alerts.slice(0, 4).map((alert) => (_jsxs("div", { className: `anomaly-pill severity-${alert.severity}`, children: [_jsx("strong", { children: alert.title }), _jsx("span", { children: alert.detail })] }, alert.id)))) })] }), _jsxs("article", { className: "panel panel-wide", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Traffic Trends" }), _jsx("p", { children: "Rolling five-second buckets from the last minute." })] }) }), _jsx(TrafficChart, { timeseries: snapshot.timeseries })] }), _jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Alignment Insights" }), _jsx("p", { children: "Detected instability and risky request behavior." })] }) }), _jsx(AlertList, { alerts: snapshot.alerts })] }), _jsxs("article", { className: "panel panel-wide", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Blaxel MCP Registry" }), _jsx("p", { children: "Workspace-discovered MCP servers from Blaxel with backend-side connection testing." })] }) }), _jsx("div", { className: "registry-list", children: blaxelFunctions.length === 0 ? (_jsx("p", { className: "empty", children: "No deployed Blaxel MCP servers were discovered in workspace dk09." })) : (blaxelFunctions.map((item) => (_jsxs("div", { className: "registry-card", children: [_jsxs("div", { className: "registry-top", children: [_jsx("strong", { children: item.displayName }), _jsx("span", { className: `status-pill ${item.enabled ? "status-online" : "status-offline"}`, children: item.status })] }), _jsxs("p", { children: [item.transport, " ", item.url ? `- ${item.url}` : ""] }), _jsxs("div", { className: "registry-actions", children: [_jsx("button", { type: "button", className: "action-button", onClick: () => onTestFunction(item.name), children: "Test Connection" }), _jsx("button", { type: "button", className: "action-button action-button-secondary", onClick: () => onLoadTools(item.name), children: "Load Tools" }), _jsx("span", { className: "registry-status", children: functionTestState[item.name] ?? "Not tested yet" })] }), _jsx("p", { className: "registry-status", children: functionToolState[item.name] ?? "No tool metadata loaded." }), functionTools[item.name]?.length ? (_jsx("div", { className: "registry-tools", children: functionTools[item.name].map((tool) => (_jsx("span", { className: "registry-tool-pill", title: tool.description, children: tool.name }, `${item.name}-${tool.name}`))) })) : null] }, item.name)))) })] }), _jsxs("article", { className: "panel panel-wide", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Topology Snapshot" }), _jsx("p", { children: "Current network structure, traffic flow, and attached tool capabilities for each MCP." })] }) }), _jsx(TopologyGraph, { topologyElements: topologyElements })] }), _jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Latest Trace" }), _jsx("p", { children: "Most recent request flow entering the system." })] }) }), snapshot.traces[0] ? _jsx(TraceDetail, { trace: snapshot.traces[0] }) : _jsx("p", { className: "empty", children: "No traces available." })] })] }));
}
function TopologyPage({ snapshot, graphElements, }) {
    const [showClusters, setShowClusters] = useState(false);
    return (_jsxs("section", { className: "dashboard-grid", children: [_jsxs("article", { className: "panel panel-wide", children: [_jsxs("div", { className: "panel-header panel-header-stack", children: [_jsxs("div", { children: [_jsx("h2", { children: "MCP Topology Graph" }), _jsx("p", { children: "Directed edges stay readable, cluster mode groups servers by role, and tool leaf nodes show exposed capabilities." })] }), _jsx("button", { type: "button", className: `view-toggle ${showClusters ? "view-toggle-active" : ""}`, onClick: () => setShowClusters((current) => !current), children: "Clusters" })] }), _jsx(TopologyGraph, { topologyElements: showClusters ? graphElements.clustered : graphElements.flat, tall: true, clustered: showClusters })] }), _jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Dependency Edges" }), _jsx("p", { children: "Most active connections in the last minute." })] }) }), _jsx("div", { className: "edge-list", children: snapshot.dependencies.map((edge) => (_jsxs("div", { className: "edge-card", children: [_jsxs("strong", { children: [edge.source, " -> ", edge.target] }), _jsxs("div", { className: "trace-meta", children: [_jsxs("span", { children: [edge.volume, " req"] }), _jsxs("span", { children: [edge.averageLatencyMs, "ms avg"] })] })] }, `${edge.source}-${edge.target}`))) })] }), _jsxs("article", { className: "panel panel-wide", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Alignment Insights" }), _jsx("p", { children: "Network-level anomalies surfaced from dependency and trace patterns." })] }) }), _jsx(AlertList, { alerts: snapshot.alerts })] })] }));
}
function HealthPage({ snapshot }) {
    return (_jsxs("section", { className: "dashboard-grid", children: [_jsxs("article", { className: "panel panel-wide", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Server Health" }), _jsx("p", { children: "Heartbeat, throughput, latency, and failure rate per MCP server." })] }) }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Server" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Heartbeat" }), _jsx("th", { children: "Req/Min" }), _jsx("th", { children: "Avg Latency" }), _jsx("th", { children: "P95" }), _jsx("th", { children: "Failure Rate" })] }) }), _jsx("tbody", { children: snapshot.servers.map((server) => (_jsxs("tr", { children: [_jsx("td", { children: server.name }), _jsx("td", { children: _jsx("span", { className: `status-pill status-${server.status}`, children: server.status }) }), _jsx("td", { children: server.heartbeatAt ? relativeTime(server.heartbeatAt) : "none" }), _jsx("td", { children: server.requestsPerMinute }), _jsxs("td", { children: [server.averageLatencyMs, "ms"] }), _jsxs("td", { children: [server.p95LatencyMs, "ms"] }), _jsxs("td", { children: [Math.round(server.errorRate * 100), "%"] })] }, server.name))) })] }) })] }), _jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Latency" }), _jsx("p", { children: "Average latency trend over the last minute." })] }) }), _jsx(LatencyChart, { timeseries: snapshot.timeseries })] }), _jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Failures" }), _jsx("p", { children: "Servers with the highest recent failure pressure." })] }) }), _jsx("div", { className: "alerts", children: snapshot.servers
                            .slice()
                            .sort((a, b) => b.errorRate - a.errorRate)
                            .map((server) => (_jsxs("div", { className: "alert-card", children: [_jsxs("div", { className: "alert-title-row", children: [_jsx("strong", { children: server.name }), _jsxs("span", { children: [Math.round(server.errorRate * 100), "%"] })] }), _jsxs("p", { children: [server.requestsPerMinute, " requests/min, p95 ", server.p95LatencyMs, "ms."] })] }, server.name))) })] })] }));
}
function LogsPage({ traces, selectedTrace, selectedTraceId, onSelectTrace, }) {
    function exportTrace(trace) {
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
            .map((row) => row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","))
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
    return (_jsxs("section", { className: "dashboard-grid", children: [_jsxs("article", { className: "panel", children: [_jsx("div", { className: "panel-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Request Logs" }), _jsx("p", { children: "Recent traces reconstructed from MCP telemetry events." })] }) }), _jsx("div", { className: "trace-list", children: traces.map((trace) => (_jsxs("button", { className: `trace-card ${trace.traceId === selectedTraceId ? "trace-card-active" : ""}`, onClick: () => onSelectTrace(trace.traceId), type: "button", children: [_jsxs("div", { className: "trace-top", children: [_jsx("strong", { children: trace.requestId }), _jsx("span", { className: `status-pill status-${trace.status}`, children: trace.status })] }), _jsx("p", { children: trace.path.join(" -> ") }), _jsxs("div", { className: "trace-meta", children: [_jsxs("span", { children: [trace.totalLatencyMs, "ms total"] }), _jsx("span", { children: formatTime(trace.updatedAt) })] })] }, trace.traceId))) })] }), _jsxs("article", { className: "panel panel-wide", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Trace Detail" }), _jsx("p", { children: "Hop-by-hop lifecycle of the selected request." })] }), selectedTrace ? (_jsx("button", { type: "button", className: "action-button export-button", onClick: () => exportTrace(selectedTrace), children: "Export Excel CSV" })) : null] }), selectedTrace ? _jsx(TraceDetail, { trace: selectedTrace }) : _jsx("p", { className: "empty", children: "Select a trace to inspect it." })] })] }));
}
function MetricCard({ label, value }) {
    return (_jsxs("div", { className: "metric-card", children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function TrafficChart({ timeseries }) {
    return (_jsx("div", { className: "chart-wrap", children: _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(AreaChart, { data: timeseries, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "requestsFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#fb7185", stopOpacity: 0.45 }), _jsx("stop", { offset: "95%", stopColor: "#fb7185", stopOpacity: 0.05 })] }) }), _jsx(CartesianGrid, { stroke: "rgba(148, 163, 184, 0.18)", vertical: false }), _jsx(XAxis, { dataKey: "timestamp", tickFormatter: (value) => formatTime(value).slice(0, 8), stroke: "#94a3b8" }), _jsx(YAxis, { stroke: "#94a3b8" }), _jsx(Tooltip, { labelFormatter: (value) => formatTime(Number(value)), contentStyle: { backgroundColor: "#161b22", border: "1px solid #2b3442" } }), _jsx(Area, { type: "monotone", dataKey: "requests", stroke: "#fb7185", fill: "url(#requestsFill)" }), _jsx(Line, { type: "monotone", dataKey: "failures", stroke: "#facc15", strokeWidth: 2, dot: false })] }) }) }));
}
function LatencyChart({ timeseries }) {
    return (_jsx("div", { className: "chart-wrap", children: _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: timeseries, children: [_jsx(CartesianGrid, { stroke: "rgba(148, 163, 184, 0.18)", vertical: false }), _jsx(XAxis, { dataKey: "timestamp", tickFormatter: (value) => formatTime(value).slice(0, 8), stroke: "#94a3b8" }), _jsx(YAxis, { stroke: "#94a3b8" }), _jsx(Tooltip, { labelFormatter: (value) => formatTime(Number(value)), contentStyle: { backgroundColor: "#161b22", border: "1px solid #2b3442" } }), _jsx(Line, { type: "monotone", dataKey: "averageLatencyMs", stroke: "#38bdf8", strokeWidth: 2, dot: false })] }) }) }));
}
function AlertList({ alerts }) {
    return (_jsx("div", { className: "alerts", children: alerts.length === 0 ? (_jsx("p", { className: "empty", children: "No anomalies detected in the recent telemetry window." })) : (alerts.map((alert) => (_jsxs("div", { className: `alert-card severity-${alert.severity}`, children: [_jsxs("div", { className: "alert-title-row", children: [_jsx("strong", { children: alert.title }), _jsx("span", { children: formatTime(alert.timestamp) })] }), _jsx("p", { children: alert.detail })] }, alert.id)))) }));
}
function TopologyGraph({ topologyElements, tall = false, clustered = false, }) {
    const cyRef = useRef(null);
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) {
            return;
        }
        if (clustered) {
            cy.nodes().forEach((node) => {
                const clusterX = node.data("clusterX");
                const clusterY = node.data("clusterY");
                if (typeof clusterX === "number" && typeof clusterY === "number") {
                    node.animate({
                        position: { x: clusterX, y: clusterY },
                    }, {
                        duration: 560,
                        easing: "ease-in-out-cubic",
                    });
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
    return (_jsxs("div", { className: `graph-wrap ${tall ? "graph-wrap-tall" : ""}`, children: [_jsx(CytoscapeComponent, { className: "graph-canvas", elements: topologyElements, style: { width: "100%", height: "100%", position: "relative", zIndex: 1 }, layout: clustered
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
                    }, stylesheet: [
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
                ], cy: (cy) => {
                    cyRef.current = cy;
                } }), clustered ? (_jsxs("div", { className: "cluster-overlay", "aria-hidden": "true", children: [_jsx("div", { className: "cluster-ring cluster-ring-entry", children: _jsx("span", { children: "Entry Cluster" }) }), _jsx("div", { className: "cluster-ring cluster-ring-retrieval", children: _jsx("span", { children: "Retrieval Cluster" }) }), _jsx("div", { className: "cluster-ring cluster-ring-context", children: _jsx("span", { children: "Context Cluster" }) }), _jsx("div", { className: "cluster-ring cluster-ring-files", children: _jsx("span", { children: "Files Cluster" }) }), _jsx("div", { className: "cluster-ring cluster-ring-sandbox", children: _jsx("span", { children: "Sandbox Cluster" }) })] })) : null] }));
}
function TraceDetail({ trace }) {
    return (_jsxs("div", { className: "trace-detail", children: [_jsxs("div", { className: "trace-banner", children: [_jsxs("div", { children: [_jsx("strong", { children: trace.requestId }), _jsx("p", { children: trace.path.join(" -> ") })] }), _jsx("span", { className: `status-pill status-${trace.status}`, children: trace.status })] }), _jsx("div", { className: "hop-list", children: trace.hops.map((hop, index) => (_jsxs("div", { className: "hop-card", children: [_jsxs("div", { className: "hop-header", children: [_jsx("strong", { children: hop.eventType }), _jsx("span", { children: formatTime(hop.timestamp) })] }), _jsxs("p", { children: [hop.source, hop.target ? ` -> ${hop.target}` : ""] }), _jsxs("div", { className: "hop-meta", children: [_jsxs("span", { children: [hop.latencyMs, "ms"] }), _jsx("span", { className: `event-${hop.status}`, children: hop.status })] }), hop.errorMessage ? _jsx("p", { className: "hop-error", children: hop.errorMessage }) : null] }, `${trace.traceId}-${index}`))) })] }));
}
export default App;
