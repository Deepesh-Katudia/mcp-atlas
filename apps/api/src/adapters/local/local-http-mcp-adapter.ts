import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import type { McpAdapter } from "../types.js";

export class LocalHttpMcpAdapter implements McpAdapter {
  constructor(private readonly record: McpRegistryRecord & { url: string }) {}

  describeServer() {
    return this.record;
  }

  async listTools() {
    return this.record.tools;
  }

  async healthcheck() {
    try {
      const response = await fetch(`${this.record.url}/health`);
      return response.ok ? "online" : "degraded";
    } catch {
      return "offline";
    }
  }

  async callTool(toolName: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.record.url}/tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, toolName }),
    });

    if (!response.ok) {
      throw new Error(`Local MCP call failed for ${toolName}`);
    }

    return response.json();
  }
}
