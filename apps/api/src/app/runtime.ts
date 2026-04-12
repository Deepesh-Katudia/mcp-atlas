import type { McpAdapter } from "../adapters/types.js";
import type { Alert, DashboardSnapshot, TelemetryEvent, TraceSummary } from "@mcp-atlas/contracts";
import type { BlaxelStatus } from "../blaxel.js";
import type { BlaxelFunctionRecord } from "../blaxel-functions.js";
import { AnomaliesService } from "../modules/anomalies/anomalies-service.js";
import { TraceQueryService } from "../modules/logs/trace-query-service.js";
import { TelemetryService } from "../modules/telemetry/telemetry-service.js";
import { TopologyService } from "../modules/topology/topology-service.js";
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
    getAdapter(slug: string): McpAdapter | null;
  };
  services: {
    telemetry: {
      ingest(event: TelemetryEvent): void;
      snapshot(): DashboardSnapshot;
    };
    topology: {
      fromSnapshot(snapshot: DashboardSnapshot): {
        nodes: Array<{ id: string; status: string }>;
        edges: DashboardSnapshot["dependencies"];
        toolsets: DashboardSnapshot["toolsets"];
      };
    };
    anomalies: {
      list(snapshot: DashboardSnapshot): Alert[];
    };
    traces: {
      list(snapshot: DashboardSnapshot): TraceSummary[];
      getById(snapshot: DashboardSnapshot, traceId: string): TraceSummary | null;
    };
  };
  compatibility: CompatibilityRuntime;
}

export function createRuntime(
  registryService: ApiRuntime["registryService"],
  compatibility: CompatibilityRuntime,
  options?: {
    snapshotDecorator?: (snapshot: DashboardSnapshot) => DashboardSnapshot;
  },
): ApiRuntime {
  const store = new TelemetryStore();

  return {
    store,
    registryService,
    services: {
      telemetry: new TelemetryService(store, options?.snapshotDecorator),
      topology: new TopologyService(),
      anomalies: new AnomaliesService(),
      traces: new TraceQueryService(),
    },
    compatibility,
  };
}
