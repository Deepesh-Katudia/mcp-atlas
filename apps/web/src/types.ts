export type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";

export interface BlaxelFunctionRecord {
  name: string;
  displayName: string;
  transport: string;
  url: string | null;
  enabled: boolean;
  status: string;
}

export interface BlaxelToolRecord {
  name: string;
  description?: string;
}
