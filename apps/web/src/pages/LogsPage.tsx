import { useDashboardAppContext } from "../app/App";
import { TraceDetail } from "../features/logs/TraceDetail";
import { TraceList } from "../features/logs/TraceList";
import { exportTraceCsv } from "../features/logs/export-trace-csv";

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
        <TraceList traces={snapshot.traces} selectedTraceId={selectedTraceId} onSelectTrace={setSelectedTraceId} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Trace Detail</h2>
            <p>Hop-by-hop lifecycle of the selected request.</p>
          </div>
          {selectedTrace ? (
            <button type="button" className="action-button export-button" onClick={() => exportTraceCsv(selectedTrace)}>
              Export Excel CSV
            </button>
          ) : null}
        </div>
        {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">Select a trace to inspect it.</p>}
      </article>
    </section>
  );
}
