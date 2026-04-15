import type { TraceSummary } from "@mcp-atlas/contracts";
import { formatTime } from "../shared/dashboard-formatters";

export function TraceList({
  traces,
  selectedTraceId,
  onSelectTrace,
}: {
  traces: TraceSummary[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string) => void;
}) {
  return (
    <div className="trace-list" role="list" aria-label="Trace list">
      {traces.map((trace) => (
        <button
          key={trace.traceId}
          className={`trace-card ${trace.traceId === selectedTraceId ? "trace-card-active" : ""}`}
          onClick={() => onSelectTrace(trace.traceId)}
          type="button"
          role="listitem"
        >
          <div className="trace-top">
            <div className="trace-title-block">
              <strong>{trace.requestId}</strong>
              <span className="trace-origin">{trace.origin}</span>
            </div>
            <span className={`status-pill status-${trace.status}`}>{trace.status}</span>
          </div>
          <p className="trace-path">{trace.path.join(" -> ")}</p>
          <div className="trace-meta">
            <span>{trace.totalLatencyMs}ms total</span>
            <span>{formatTime(trace.updatedAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
