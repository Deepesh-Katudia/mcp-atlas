import type { TraceSummary } from "@mcp-atlas/contracts";
import { TraceDetail } from "./TraceDetail";
import { TraceList } from "./TraceList";
import { exportTraceCsv } from "./export-trace-csv";

type LogsWorkspaceProps = {
  traces: TraceSummary[];
  selectedTrace: TraceSummary | null;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string) => void;
};

export function LogsWorkspace({ traces, selectedTrace, selectedTraceId, onSelectTrace }: LogsWorkspaceProps) {
  return (
    <section className="logs-workspace dashboard-grid">
      <article className="panel panel-wide logs-workspace-list">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>Request Logs</h2>
            <p>Recent traces reconstructed from MCP telemetry events.</p>
          </div>
        </div>
        <TraceList traces={traces} selectedTraceId={selectedTraceId} onSelectTrace={onSelectTrace} />
      </article>

      <article className="panel panel-wide logs-workspace-detail logs-workspace-detail-dark">
        <div className="panel-header">
          <div>
            <h2>Trace Detail</h2>
            <p>Hop-by-hop lifecycle of the selected request.</p>
          </div>
          {selectedTrace ? (
            <div className="logs-workspace-export">
              <button
                type="button"
                className="action-button export-button"
                onClick={() => exportTraceCsv(selectedTrace)}
              >
                Export Excel CSV
              </button>
            </div>
          ) : null}
        </div>
        {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">Select a trace to inspect it.</p>}
      </article>
    </section>
  );
}
