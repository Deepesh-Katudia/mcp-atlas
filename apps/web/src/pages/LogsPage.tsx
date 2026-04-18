import { useDashboardAppContext } from "../app/App";
import { PageHeader } from "../app/PageHeader";
import { LogsWorkspace } from "../features/logs/LogsWorkspace";

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
    <>
      <PageHeader
        eyebrow="Request tracing"
        title="Logs workspace"
        description="Review request paths in a quieter split view, with the trace list on paper and the selected run on a dark inspection surface."
      />
      <LogsWorkspace
        traces={snapshot.traces}
        selectedTrace={selectedTrace}
        selectedTraceId={selectedTraceId}
        onSelectTrace={setSelectedTraceId}
      />
    </>
  );
}
