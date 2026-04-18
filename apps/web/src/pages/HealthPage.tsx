import { useDashboardAppContext } from "../app/App";
import { PageHeader } from "../app/PageHeader";
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

  return (
    <>
      <PageHeader
        eyebrow="Service posture"
        title="Health workspace"
        description="Scan server status in a lighter operations shell, then drop into darker inset views where trends need extra contrast."
      />
      <HealthGrid snapshot={snapshot} />
    </>
  );
}
