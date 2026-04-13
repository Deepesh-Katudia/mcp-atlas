export function LiveTrafficControls({
  pending,
  message,
  onRunAgentTask,
  onRunSearch,
  onRunFailure,
  onRunBlaxelTask,
}: {
  pending: boolean;
  message: string | null;
  onRunAgentTask: () => void;
  onRunSearch: () => void;
  onRunFailure: () => void;
  onRunBlaxelTask: () => void;
}) {
  return (
    <section className="action-bar">
      <div>
        <p className="eyebrow action-eyebrow">Live Traffic Controls</p>
        <strong>Trigger real local or Blaxel sandbox MCP traffic through the Atlas proxy.</strong>
      </div>
      <div className="action-buttons">
        <button type="button" className="action-button" onClick={onRunAgentTask} disabled={pending}>
          Run Agent Task
        </button>
        <button type="button" className="action-button" onClick={onRunSearch} disabled={pending}>
          Call Search MCP
        </button>
        <button type="button" className="action-button" onClick={onRunBlaxelTask} disabled={pending}>
          Run Blaxel Sandbox MCP
        </button>
        <button type="button" className="action-button action-button-danger" onClick={onRunFailure} disabled={pending}>
          Trigger Failure
        </button>
      </div>
      <p className="action-message">{pending ? "Running live request..." : message ?? "Ready for live traffic."}</p>
    </section>
  );
}

export { LiveTrafficControls as ActionBar };
