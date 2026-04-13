import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerRegistryRoutes } from "./registry-routes.js";

describe("registerRegistryRoutes", () => {
  it("returns normalized MCP registry records", async () => {
    const app = express();

    registerRegistryRoutes(app, {
      listMcps: async () => [
        {
          slug: "search-mcp",
          name: "Search MCP",
          transport: "http",
          status: "online",
          tools: [],
          url: "http://localhost:4001",
        },
      ],
    });

    const response = await request(app).get("/api/registry/mcps");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: "search-mcp",
        name: "Search MCP",
        transport: "http",
        status: "online",
        tools: [],
        url: "http://localhost:4001",
      },
    ]);
  });

  it("returns a structured 500 response when MCP lookup fails", async () => {
    const app = express();

    registerRegistryRoutes(app, {
      listMcps: async () => {
        throw new Error("registry unavailable");
      },
    });

    const response = await request(app).get("/api/registry/mcps");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Failed to load MCP registry",
    });
  });
});
