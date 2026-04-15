import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { Link } from "react-router-dom";
import type { BlaxelFunctionRecord, BlaxelToolRecord } from "../../types";
import type { GraphElementsBundle } from "../topology/build-topology-elements";
import { TraceDetail } from "../logs/TraceDetail";
import { McpRegistryPanel } from "../registry/McpRegistryPanel";
import { TopologyGraph } from "../topology/TopologyGraph";
import { MetricCard, TrafficChart } from "./OverviewCards";

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function OverviewSummary({
  snapshot,
  graphElements,
  blaxelFunctions,
  functionTestState,
  functionTools,
  functionToolState,
  onTestFunction,
  onLoadTools,
}: {
  snapshot: DashboardSnapshot;
  graphElements: GraphElementsBundle;
  blaxelFunctions: BlaxelFunctionRecord[];
  functionTestState: Record<string, string>;
  functionTools: Record<string, BlaxelToolRecord[]>;
  functionToolState: Record<string, string>;
  onTestFunction: (functionName: string) => void | Promise<void>;
  onLoadTools: (functionName: string) => void | Promise<void>;
}) {
  const latestTrace = snapshot.traces[0] ?? null;
  const latestTraffic = snapshot.timeseries.at(-1);
  const peakRequests = snapshot.timeseries.reduce((peak, point) => Math.max(peak, point.requests), 0);
  const enabledFunctions = blaxelFunctions.filter((item) => item.enabled).length;
  const loadedToolCount = Object.values(functionTools).reduce((total, tools) => total + tools.length, 0);

  return (
    <section className="overview-summary">
      <article className="panel panel-full summary-hero">
        <div className="panel-header panel-header-stack">
          <div>
            <p className="eyebrow">Executive Summary</p>
            <h2>Executive Summary</h2>
            <p>Focus on coverage, anomalies, and the latest trace moving through the Atlas control plane.</p>
          </div>
        </div>
        <div className="summary-metric-grid">
          <MetricCard
            label="Active Servers"
            value={`${snapshot.overview.activeServers}/${snapshot.overview.totalServers}`}
            detail={formatCount(snapshot.servers.filter((server) => server.status === "degraded").length, "degraded node")}
          />
          <MetricCard
            label="Requests / Min"
            value={String(snapshot.overview.requestsLastMinute)}
            detail={latestTraffic ? `Current window ${latestTraffic.requests}` : "No recent traffic"}
          />
          <MetricCard
            label="Avg Latency"
            value={`${snapshot.overview.averageLatencyMs}ms`}
            detail={peakRequests ? `Peak throughput ${peakRequests}/min` : "No throughput sample"}
          />
          <MetricCard
            label="Failed Requests"
            value={String(snapshot.overview.failedRequests)}
            detail={`${snapshot.overview.anomalyCount} active anomalies`}
          />
        </div>
      </article>

      <article className="panel panel-wide summary-panel-light">
        <div className="panel-header">
          <div>
            <h2>Active Anomalies</h2>
            <p>Top live issues that need operator attention.</p>
          </div>
          <span className={`status-pill ${snapshot.alerts.length > 0 ? "status-failed" : "status-online"}`}>
            {snapshot.alerts.length > 0 ? `${snapshot.alerts.length} active` : "clear"}
          </span>
        </div>
        <div className="summary-anomaly-list">
          {snapshot.alerts.length === 0 ? (
            <p className="empty summary-empty">No anomalies detected in the recent telemetry window.</p>
          ) : (
            snapshot.alerts.slice(0, 3).map((alert) => (
              <article key={alert.id} className={`summary-anomaly-card severity-${alert.severity}`}>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </article>
            ))
          )}
        </div>
      </article>

      <article className="panel summary-panel-light summary-links-panel">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>Quick Links</h2>
            <p>Jump directly into the deeper operational views.</p>
          </div>
        </div>
        <nav aria-label="Quick Links" className="summary-quick-links">
          <Link to="/topology" className="summary-link-card">
            <strong>Topology</strong>
            <span>Inspect node relationships and routing.</span>
          </Link>
          <Link to="/logs" className="summary-link-card">
            <strong>Logs</strong>
            <span>Review traces, request paths, and failures.</span>
          </Link>
          <Link to="/health" className="summary-link-card">
            <strong>Health</strong>
            <span>Check latency, uptime, and saturation signals.</span>
          </Link>
        </nav>
      </article>

      <article className="panel panel-wide summary-panel-dark">
        <div className="panel-header">
          <div>
            <h2>Traffic Pulse</h2>
            <p>Compact live request and failure view for the last minute.</p>
          </div>
          <div className="summary-stat-stack">
            <strong>{latestTraffic ? `${latestTraffic.failures} failures` : "No failures"}</strong>
            <span>{latestTraffic ? `${latestTraffic.averageLatencyMs}ms avg` : "No latency sample"}</span>
          </div>
        </div>
        <TrafficChart timeseries={snapshot.timeseries} compact />
      </article>

      <article className="panel summary-panel-dark">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>Topology Preview</h2>
            <p>Compact network map showing current traffic flow.</p>
          </div>
          <span className="summary-topology-meta">
            {formatCount(snapshot.dependencies.length, "active route")}
          </span>
        </div>
        <TopologyGraph topologyElements={graphElements.flat} />
      </article>

      <article className="panel panel-wide summary-panel-light">
        <div className="panel-header">
          <div>
            <h2>Latest Trace</h2>
            <p>Most recent request flow and its last known outcome.</p>
          </div>
          {latestTrace ? <span className={`status-pill status-${latestTrace.status}`}>{latestTrace.status}</span> : null}
        </div>
        {latestTrace ? (
          <div className="summary-trace-stack">
            <div className="summary-trace-meta">
              <div>
                <strong>{latestTrace.requestId}</strong>
                <p>{latestTrace.path.join(" -> ")}</p>
              </div>
              <div>
                <strong>{latestTrace.totalLatencyMs}ms</strong>
                <p>{formatCount(latestTrace.hops.length, "hop")}</p>
              </div>
            </div>
            <TraceDetail trace={latestTrace} />
          </div>
        ) : (
          <p className="empty summary-empty">No traces available.</p>
        )}
      </article>

      <article className="panel summary-panel-light">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>Registry Coverage</h2>
            <p>{`${blaxelFunctions.length} Blaxel functions discovered, ${enabledFunctions} currently enabled.`}</p>
          </div>
          <span className="summary-topology-meta">{formatCount(loadedToolCount, "loaded tool")}</span>
        </div>
        <McpRegistryPanel
          blaxelFunctions={blaxelFunctions}
          functionTestState={functionTestState}
          functionTools={functionTools}
          functionToolState={functionToolState}
          onTestFunction={onTestFunction}
          onLoadTools={onLoadTools}
        />
      </article>
    </section>
  );
}
