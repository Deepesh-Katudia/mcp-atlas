import type { McpRegistryRecord } from "@mcp-atlas/contracts";

export interface McpAdapter {
  describeServer(): McpRegistryRecord;
  listTools(): Promise<McpRegistryRecord["tools"]>;
  healthcheck(): Promise<"online" | "degraded" | "offline">;
  callTool(toolName: string, payload: Record<string, unknown>): Promise<unknown>;
}
