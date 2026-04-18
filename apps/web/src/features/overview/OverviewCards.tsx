import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "../shared/dashboard-formatters";

export function TrafficChart({
  timeseries,
  compact = false,
}: {
  timeseries: DashboardSnapshot["timeseries"];
  compact?: boolean;
}) {
  return (
    <div className={`chart-wrap ${compact ? "chart-wrap-compact" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timeseries}>
          <defs>
            <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffffff" stopOpacity={0.34} />
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" vertical={false} />
          <XAxis dataKey="timestamp" tickFormatter={(value: number) => formatTime(value).slice(0, 8)} stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            labelFormatter={(value: string | number) => formatTime(Number(value))}
            contentStyle={{ backgroundColor: "#111111", border: "1px solid rgba(255, 255, 255, 0.12)" }}
          />
          <Area type="monotone" dataKey="requests" stroke="#ffffff" strokeWidth={2} fill="url(#requestsFill)" />
          <Line type="monotone" dataKey="failures" stroke="#fda4af" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}

export function AlertList({ alerts }: { alerts: DashboardSnapshot["alerts"] }) {
  return (
    <div className="alerts">
      {alerts.length === 0 ? (
        <p className="empty summary-empty">No anomalies detected in the recent telemetry window.</p>
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
