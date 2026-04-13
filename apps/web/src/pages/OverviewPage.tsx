import {
  AlertList,
  TopologyGraph,
  TraceDetail,
  TrafficChart,
} from "../app/dashboard-shared";
import { useDashboardAppContext } from "../app/App";

export function OverviewPage() {
  const {
    snapshot,
    graphElements,
    blaxelFunctions,
    functionTestState,
    functionTools,
    functionToolState,
    onTestFunction,
    onLoadTools,
  } = useDashboardAppContext();

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-full">
          <p className="empty">Loading dashboard data...</p>
        </article>
      </section>
    );
  }

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
                <p>
                  {item.transport} {item.url ? `- ${item.url}` : ""}
                </p>
                <div className="registry-actions">
                  <button type="button" className="action-button" onClick={() => void onTestFunction(item.name)}>
                    Test Connection
                  </button>
                  <button
                    type="button"
                    className="action-button action-button-secondary"
                    onClick={() => void onLoadTools(item.name)}
                  >
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
        <TopologyGraph topologyElements={graphElements.flat} />
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
