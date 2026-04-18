import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ResizablePanel } from "../../components/ResizablePanel";
import { formatTime, relativeTime } from "../shared/dashboard-formatters";

function LatencyChart({ timeseries }: { timeseries: DashboardSnapshot["timeseries"] }) {
  return (
    <div className="chart-wrap health-chart-surface">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={timeseries}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: number) => formatTime(value).slice(0, 8)}
            stroke="#94a3b8"
          />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(value: string | number) => formatTime(Number(value))}
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #2b3442" }}
          />
          <Line type="monotone" dataKey="averageLatencyMs" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HealthGrid({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="dashboard-grid health-grid">
      <ResizablePanel
        as="article"
        panelId="health-table"
        label="server health"
        className="panel panel-wide health-table-panel"
        minSize={{ width: 520, height: 360 }}
        maxSize={{ width: 1600, height: 1200 }}
      >
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
      </ResizablePanel>

      <ResizablePanel
        as="article"
        panelId="health-latency"
        label="latency"
        className="panel health-chart-panel"
        minSize={{ width: 320, height: 320 }}
        maxSize={{ width: 1200, height: 960 }}
      >
        <div className="panel-header">
          <div>
            <h2>Latency</h2>
            <p>Average latency trend over the last minute.</p>
          </div>
        </div>
        <LatencyChart timeseries={snapshot.timeseries} />
      </ResizablePanel>

      <ResizablePanel
        as="article"
        panelId="health-failures"
        label="failures"
        className="panel health-alerts-panel"
        minSize={{ width: 320, height: 320 }}
        maxSize={{ width: 1200, height: 960 }}
      >
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
      </ResizablePanel>
    </section>
  );
}
