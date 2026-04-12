import type { BlaxelStatus } from "../blaxel.js";
import type { BlaxelFunctionRecord } from "../blaxel-functions.js";
import { TelemetryStore } from "../store.js";

export interface CompatibilityRuntime {
  getSnapshot(): unknown;
  getBlaxelStatus(): BlaxelStatus;
  listBlaxelFunctions(): Promise<BlaxelFunctionRecord[]>;
  testBlaxelFunction(functionName: string): Promise<unknown>;
  listBlaxelTools(functionName: string): Promise<unknown>;
  callBlaxelFunctionTool(functionName: string, toolName: string, payload: Record<string, unknown>): Promise<unknown>;
  pingBlaxelMcp(): Promise<unknown>;
  listBlaxelMcpTools(): Promise<unknown>;
  callBlaxelMcpTool(toolName: string, payload: Record<string, unknown>): Promise<unknown>;
  runBlaxelProcessesList(): Promise<unknown>;
  listServices(): unknown[];
  proxyRequest(mcpName: string, payload: unknown): Promise<unknown>;
  runAgentTask(payload: unknown): Promise<unknown>;
}

export interface ApiRuntime {
  store: TelemetryStore;
  registryService: {
    listMcps(): Promise<unknown[]>;
  };
  compatibility: CompatibilityRuntime;
}

export function createRuntime(
  registryService: ApiRuntime["registryService"],
  compatibility: CompatibilityRuntime,
): ApiRuntime {
  return {
    store: new TelemetryStore(),
    registryService,
    compatibility,
  };
}
