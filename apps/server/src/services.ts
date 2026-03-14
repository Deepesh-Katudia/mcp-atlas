import type { McpName } from "./types.js";

export interface AtlasService {
  name: Exclude<McpName, "Gateway MCP">;
  slug: "search-mcp" | "memory-mcp" | "file-mcp";
  url: string;
}

export const atlasServices: AtlasService[] = [
  {
    name: "Search MCP",
    slug: "search-mcp",
    url: process.env.SEARCH_MCP_URL ?? "http://localhost:4001",
  },
  {
    name: "Memory MCP",
    slug: "memory-mcp",
    url: process.env.MEMORY_MCP_URL ?? "http://localhost:4002",
  },
  {
    name: "File MCP",
    slug: "file-mcp",
    url: process.env.FILE_MCP_URL ?? "http://localhost:4003",
  },
];

export const serviceBySlug = Object.fromEntries(atlasServices.map((service) => [service.slug, service])) as Record<
  AtlasService["slug"],
  AtlasService
>;
