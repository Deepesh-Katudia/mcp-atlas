import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import type { McpAdapter } from "../../adapters/types.js";

export class McpRegistryService {
  constructor(private readonly adapters: Map<string, McpAdapter>) {}

  async listMcps(): Promise<McpRegistryRecord[]> {
    return Promise.all(
      Array.from(this.adapters.values()).map(async (adapter) => {
        const record = adapter.describeServer();
        const [status, tools] = await Promise.all([
          adapter.healthcheck().catch(() => record.status),
          adapter.listTools().catch(() => record.tools),
        ]);

        return {
          ...record,
          status,
          tools,
        };
      }),
    );
  }

  getAdapter(slug: string) {
    return this.adapters.get(slug) ?? null;
  }
}
