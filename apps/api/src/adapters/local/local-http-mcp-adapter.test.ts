import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalHttpMcpAdapter } from "./local-http-mcp-adapter.js";

describe("LocalHttpMcpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the local MCP tool endpoint and returns JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tool: "search", results: ["one"] }),
      }),
    );

    const adapter = new LocalHttpMcpAdapter({
      slug: "search-mcp",
      name: "Search MCP",
      url: "http://localhost:4001",
      transport: "http",
      status: "online",
      tools: [{ id: "search", name: "search", description: "Search", requestCount: 0, averageLatencyMs: 0 }],
    });

    const result = await adapter.callTool("search", { query: "atlas" });

    expect(result).toEqual({ tool: "search", results: ["one"] });
  });
});
