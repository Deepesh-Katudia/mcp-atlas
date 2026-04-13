import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import { BlaxelMcpService } from "../../blaxel-mcp.js";
import type { McpAdapter } from "../types.js";

export class BlaxelSandboxAdapter implements McpAdapter {
  constructor(
    private readonly record: McpRegistryRecord,
    private readonly client: BlaxelMcpService,
  ) {}

  describeServer() {
    return this.record;
  }

  async listTools() {
    const response = await this.client.listTools();
    return response.tools.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description ?? null,
      requestCount: 0,
      averageLatencyMs: 0,
    }));
  }

  async healthcheck() {
    try {
      await this.client.ping();
      return "online";
    } catch {
      return "offline";
    }
  }

  async callTool(toolName: string, payload: Record<string, unknown>) {
    return this.client.callTool(toolName, payload);
  }
}
