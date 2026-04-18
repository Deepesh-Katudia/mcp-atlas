import type { TraceSummary } from "@mcp-atlas/contracts";
import { MasonryWorkspace } from "../../components/MasonryWorkspace";
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
  const listContent = (
    <>
      <div className="panel-header panel-header-stack">
        <div>
          <h2>Request Logs</h2>
          <p>Recent traces reconstructed from MCP telemetry events.</p>
        </div>
      </div>
      <TraceList traces={traces} selectedTraceId={selectedTraceId} onSelectTrace={onSelectTrace} />
    </>
  );

  const detailContent = (
    <>
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
    </>
  );

  return (
    <MasonryWorkspace
      workspaceId="logs"
      className="logs-workspace"
      items={[
        {
          id: "logs-list",
          label: "request logs",
          className: "panel logs-workspace-list",
          as: "article",
          defaultSize: { width: 520, height: 640 },
          minSize: { width: 360, height: 420 },
          maxSize: { width: 1200, height: 1200 },
          content: listContent,
        },
        {
          id: "logs-detail",
          label: "trace detail",
          className: "panel logs-workspace-detail logs-workspace-detail-dark",
          as: "article",
          defaultSize: { width: 720, height: 720 },
          minSize: { width: 420, height: 420 },
          maxSize: { width: 1400, height: 1200 },
          content: detailContent,
        },
      ]}
    />
  );
}
