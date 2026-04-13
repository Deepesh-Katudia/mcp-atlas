import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface BlaxelMcpConfig {
  url: string;
  apiKey: string;
  workspace: string;
}

export class BlaxelMcpService {
  private getConfig(urlOverride?: string): BlaxelMcpConfig {
    const url = urlOverride ?? process.env.BLAXEL_MCP_URL ?? process.env.BLAXEL_SANDBOX_MCP_URL;
    const apiKey = process.env.BL_API_KEY;
    const workspace = process.env.BL_WORKSPACE;

    if (!url) {
      throw new Error("Missing BLAXEL_MCP_URL or BLAXEL_SANDBOX_MCP_URL");
    }
    if (!apiKey) {
      throw new Error("Missing BL_API_KEY");
    }
    if (!workspace) {
      throw new Error("Missing BL_WORKSPACE");
    }

    return { url, apiKey, workspace };
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>, urlOverride?: string) {
    const config = this.getConfig(urlOverride);
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "X-Blaxel-Workspace": config.workspace,
        },
      },
    });
    const client = new Client({
      name: "mcp-atlas",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      return await fn(client);
    } finally {
      await transport.close().catch(() => undefined);
    }
  }

  async ping() {
    return this.withClient(async (client) => client.ping());
  }

  async listTools() {
    return this.withClient(async (client) => client.listTools());
  }

  async listToolsAt(url: string) {
    return this.withClient(async (client) => client.listTools(), url);
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.callToolAt(this.getConfig().url, name, args);
  }

  async callToolAt(url: string, name: string, args: Record<string, unknown>) {
    return this.withClient(async (client) =>
      client.callTool({
        name,
        arguments: args,
      }),
      url,
    );
  }
}
