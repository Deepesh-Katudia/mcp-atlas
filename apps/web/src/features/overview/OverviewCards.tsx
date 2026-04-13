import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GraphElementsBundle } from "../topology/build-topology-elements";
import { TopologyGraph } from "../topology/TopologyGraph";
import { TraceDetail } from "../logs/TraceDetail";
import { formatTime } from "../shared/dashboard-formatters";

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
          <XAxis dataKey="timestamp" tickFormatter={(value: number) => formatTime(value).slice(0, 8)} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(value: string | number) => formatTime(Number(value))}
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #2b3442" }}
          />
          <Area type="monotone" dataKey="requests" stroke="#fb7185" fill="url(#requestsFill)" />
          <Line type="monotone" dataKey="failures" stroke="#facc15" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
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

export function OverviewCards({
  snapshot,
  graphElements,
  children,
}: {
  snapshot: DashboardSnapshot;
  graphElements: GraphElementsBundle;
  children?: ReactNode;
}) {
  const selectedTrace = snapshot.traces[0] ?? null;

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

      {children}

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
        {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">No traces available.</p>}
      </article>
    </section>
  );
}
