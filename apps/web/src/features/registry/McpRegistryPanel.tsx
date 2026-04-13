import type { BlaxelFunctionRecord, BlaxelToolRecord } from "../../types";

export function McpRegistryPanel({
  blaxelFunctions,
  functionTestState,
  functionTools,
  functionToolState,
  onTestFunction,
  onLoadTools,
}: {
  blaxelFunctions: BlaxelFunctionRecord[];
  functionTestState: Record<string, string>;
  functionTools: Record<string, BlaxelToolRecord[]>;
  functionToolState: Record<string, string>;
  onTestFunction: (functionName: string) => void | Promise<void>;
  onLoadTools: (functionName: string) => void | Promise<void>;
}) {
  return (
    <div className="registry-list">
      {blaxelFunctions.length === 0 ? (
        <p className="empty">No deployed Blaxel MCP servers were discovered in workspace dk09.</p>
      ) : (
        blaxelFunctions.map((item) => (
          <div key={item.name} className="registry-card">
            <div className="registry-top">
              <strong>{item.displayName}</strong>
              <span className={`status-pill ${item.enabled ? "status-online" : "status-offline"}`}>{item.status}</span>
            </div>
            <p>
              {item.transport} {item.url ? `- ${item.url}` : ""}
            </p>
            <div className="registry-actions">
              <button type="button" className="action-button" onClick={() => void onTestFunction(item.name)}>
                Test Connection
              </button>
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={() => void onLoadTools(item.name)}
              >
                Load Tools
              </button>
              <span className="registry-status">{functionTestState[item.name] ?? "Not tested yet"}</span>
            </div>
            <p className="registry-status">{functionToolState[item.name] ?? "No tool metadata loaded."}</p>
            {functionTools[item.name]?.length ? (
              <div className="registry-tools">
                {functionTools[item.name].map((tool) => (
                  <span key={`${item.name}-${tool.name}`} className="registry-tool-pill" title={tool.description}>
                    {tool.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
