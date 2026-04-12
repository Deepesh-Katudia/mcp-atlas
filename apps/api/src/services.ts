import type { McpName } from "./types.js";

export interface AtlasServiceTool {
  id: string;
  name: string;
  description: string;
}

export interface AtlasService {
  name: Exclude<McpName, "Gateway MCP">;
  slug: "search-mcp" | "memory-mcp" | "file-mcp";
  url: string;
  tools: AtlasServiceTool[];
}

export const atlasServices: AtlasService[] = [
  {
    name: "Search MCP",
    slug: "search-mcp",
    url: process.env.SEARCH_MCP_URL ?? "http://localhost:4001",
    tools: [
      {
        id: "search",
        name: "search",
        description: "Query indexed knowledge and return ranked search results.",
      },
    ],
  },
  {
    name: "Memory MCP",
    slug: "memory-mcp",
    url: process.env.MEMORY_MCP_URL ?? "http://localhost:4002",
    tools: [
      {
        id: "memory",
        name: "memory",
        description: "Retrieve relevant context and user memory snippets.",
      },
    ],
  },
  {
    name: "File MCP",
    slug: "file-mcp",
    url: process.env.FILE_MCP_URL ?? "http://localhost:4003",
    tools: [
      {
        id: "file",
        name: "file",
        description: "Load file content and metadata for downstream use.",
      },
    ],
  },
];

export const serviceBySlug = Object.fromEntries(atlasServices.map((service) => [service.slug, service])) as Record<
  AtlasService["slug"],
  AtlasService
>;
