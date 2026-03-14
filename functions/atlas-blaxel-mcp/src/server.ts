import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleResults(query: string) {
  return [
    `${query} architecture notes`,
    `${query} latency budget checklist`,
    `${query} production rollout guide`,
  ];
}

function createServer() {
  const server = new McpServer(
    {
      name: "mcp-atlas-tools",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    "atlasSearch",
    {
      title: "Atlas Search",
      description: "Searches mock observability knowledge and returns ranked results.",
      inputSchema: {
        query: z.string().min(2).describe("Search query"),
      },
    },
    async ({ query }) => {
      await sleep(180);
      const results = sampleResults(query);
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} search results for "${query}".`,
          },
        ],
        structuredContent: {
          tool: "atlasSearch",
          query,
          results,
        },
      };
    },
  );

  server.registerTool(
    "atlasMemory",
    {
      title: "Atlas Memory",
      description: "Returns remembered user or system context for an Atlas topic.",
      inputSchema: {
        topic: z.string().min(2).describe("Topic to retrieve memory for"),
        userId: z.string().default("atlas-user").describe("User identifier"),
      },
    },
    async ({ topic, userId }) => {
      await sleep(240);
      const memories = [
        `User ${userId} prefers short latency dashboards.`,
        `Recent topic affinity: ${topic}.`,
        "Escalate failures above 20% error rate.",
      ];
      return {
        content: [
          {
            type: "text",
            text: `Recovered ${memories.length} memory entries for "${topic}".`,
          },
        ],
        structuredContent: {
          tool: "atlasMemory",
          topic,
          userId,
          memories,
        },
      };
    },
  );

  server.registerTool(
    "atlasFile",
    {
      title: "Atlas File",
      description: "Returns mock file metadata or content relevant to Atlas traces.",
      inputSchema: {
        filename: z.string().min(3).describe("Logical file name"),
        forceFailure: z.boolean().default(false).describe("Force a failure for anomaly demos"),
      },
    },
    async ({ filename, forceFailure }) => {
      await sleep(320);
      if (forceFailure) {
        throw new Error(`Hosted file tool failed for ${filename}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Loaded hosted file payload for ${filename}.`,
          },
        ],
        structuredContent: {
          tool: "atlasFile",
          filename,
          content: `Hosted Atlas content for ${filename}`,
          contentType: "text/plain",
        },
      };
    },
  );

  server.registerTool(
    "atlasAgentTask",
    {
      title: "Atlas Agent Task",
      description: "Runs a hosted multi-step Atlas workflow through search, memory, and file logic.",
      inputSchema: {
        query: z.string().min(2).describe("Task query"),
        userId: z.string().default("atlas-user").describe("User identifier"),
        filename: z.string().default("atlas-notes.txt").describe("Target file"),
        forceFileFailure: z.boolean().default(false).describe("Force hosted file step failure"),
      },
    },
    async ({ query, userId, filename, forceFileFailure }) => {
      await sleep(160);
      const searchResults = sampleResults(query);
      await sleep(220);
      const memories = [
        `User ${userId} previously searched ${query}.`,
        "Current dashboard focus: live Blaxel MCP telemetry.",
      ];
      await sleep(300);
      if (forceFileFailure) {
        throw new Error(`Hosted agent task failed while reading ${filename}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Completed hosted Atlas task for "${query}".`,
          },
        ],
        structuredContent: {
          tool: "atlasAgentTask",
          query,
          userId,
          filename,
          search: {
            results: searchResults,
          },
          memory: {
            memories,
          },
          file: {
            filename,
            content: `Hosted Atlas file payload for ${filename}`,
          },
        },
      };
    },
  );

  return server;
}

const app = createMcpExpressApp();

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "mcp-atlas-tools" });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal server error",
        },
        id: null,
      });
    }
  } finally {
    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close();
    });
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

const port = Number(process.env.MCP_PORT ?? 3000);
app.listen(port, () => {
  console.log(`Atlas Blaxel MCP server listening on port ${port}`);
});
