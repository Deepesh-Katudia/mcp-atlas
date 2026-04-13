import { useDashboardAppContext } from "../app/App";
import { HealthGrid } from "../features/health/HealthGrid";

export function HealthPage() {
  const { snapshot } = useDashboardAppContext();

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="empty">Loading health data...</p>
        </article>
      </section>
    );
  }

  return <HealthGrid snapshot={snapshot} />;
}
