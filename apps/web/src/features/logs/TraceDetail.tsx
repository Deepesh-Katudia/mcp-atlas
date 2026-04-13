import type { TraceSummary } from "@mcp-atlas/contracts";
import { formatTime } from "../shared/dashboard-formatters";

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
