import { LiveTrafficControls } from "../features/controls/LiveTrafficControls";
import { OverviewCards } from "../features/overview/OverviewCards";
import { McpRegistryPanel } from "../features/registry/McpRegistryPanel";
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
      <OverviewCards snapshot={snapshot} graphElements={graphElements}>
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <h2>Blaxel MCP Registry</h2>
              <p>Workspace-discovered MCP servers from Blaxel with backend-side connection testing.</p>
            </div>
          </div>
          <McpRegistryPanel
            blaxelFunctions={blaxelFunctions}
            functionTestState={functionTestState}
            functionTools={functionTools}
            functionToolState={functionToolState}
            onTestFunction={onTestFunction}
            onLoadTools={onLoadTools}
          />
        </article>
      </OverviewCards>
    </>
  );
}
