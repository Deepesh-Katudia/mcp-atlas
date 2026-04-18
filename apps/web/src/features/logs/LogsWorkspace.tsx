import type { TraceSummary } from "@mcp-atlas/contracts";
import { ResizablePanel } from "../../components/ResizablePanel";
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
      <ResizablePanel
        as="article"
        panelId="logs-list"
        label="request logs"
        className="panel panel-wide logs-workspace-list"
        minSize={{ width: 360, height: 420 }}
        maxSize={{ width: 1200, height: 1200 }}
      >
        <div className="panel-header panel-header-stack">
          <div>
            <h2>Request Logs</h2>
            <p>Recent traces reconstructed from MCP telemetry events.</p>
          </div>
        </div>
        <TraceList traces={traces} selectedTraceId={selectedTraceId} onSelectTrace={onSelectTrace} />
      </ResizablePanel>

      <ResizablePanel
        as="article"
        panelId="logs-detail"
        label="trace detail"
        className="panel panel-wide logs-workspace-detail logs-workspace-detail-dark"
        minSize={{ width: 420, height: 420 }}
        maxSize={{ width: 1400, height: 1200 }}
      >
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
      </ResizablePanel>
    </section>
  );
}
