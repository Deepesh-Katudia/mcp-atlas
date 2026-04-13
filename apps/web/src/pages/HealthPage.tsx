import { LatencyChart, relativeTime } from "../app/dashboard-shared";
import { useDashboardAppContext } from "../app/App";

export function HealthPage() {
  const { snapshot } = useDashboardAppContext();

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="empty">Loading health data...</p>
        </article>
      </section>
    );
  }

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
