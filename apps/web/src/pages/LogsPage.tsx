import type { TraceSummary } from "@mcp-atlas/contracts";
import { TraceDetail, formatDateForFile, formatTime } from "../app/dashboard-shared";
import { useDashboardAppContext } from "../app/App";

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
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
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

export function LogsPage() {
  const { snapshot, selectedTrace, selectedTraceId, setSelectedTraceId } = useDashboardAppContext();

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="empty">Loading trace logs...</p>
        </article>
      </section>
    );
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
          {snapshot.traces.map((trace) => (
            <button
              key={trace.traceId}
              className={`trace-card ${trace.traceId === selectedTraceId ? "trace-card-active" : ""}`}
              onClick={() => setSelectedTraceId(trace.traceId)}
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
