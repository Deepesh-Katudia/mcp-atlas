import { LiveTrafficControls } from "../features/controls/LiveTrafficControls";
import { OverviewSummary } from "../features/overview/OverviewSummary";
import { useDashboardAppContext } from "../app/App";

export function OverviewPage() {
  const {
    snapshot,
    graphElements,
    blaxelFunctions,
    functionTestState,
    functionTools,
    functionToolState,
    onTestFunction,
    onLoadTools,
    actionPending,
    actionMessage,
    onRunAgentTask,
    onRunSearch,
    onRunFailure,
    onRunBlaxelTask,
  } = useDashboardAppContext();

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-full">
          <p className="empty">Loading dashboard data...</p>
        </article>
      </section>
    );
  }

  return (
    <>
      <LiveTrafficControls
        pending={actionPending}
        message={actionMessage}
        onRunAgentTask={() => void onRunAgentTask()}
        onRunSearch={() => void onRunSearch()}
        onRunFailure={() => void onRunFailure()}
        onRunBlaxelTask={() => void onRunBlaxelTask()}
      />
      <OverviewSummary
        snapshot={snapshot}
        graphElements={graphElements}
        blaxelFunctions={blaxelFunctions}
        functionTestState={functionTestState}
        functionTools={functionTools}
        functionToolState={functionToolState}
        onTestFunction={onTestFunction}
        onLoadTools={onLoadTools}
      />
    </>
  );
}
