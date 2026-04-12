import type { Express } from "express";

export function registerRegistryRoutes(
  app: Express,
  registryService: { listMcps(): Promise<unknown[]> },
) {
  app.get("/api/registry/mcps", async (_req, res) => {
    try {
      const records = await registryService.listMcps();
      res.json(records);
    } catch {
      res.status(500).json({
        error: "Failed to load MCP registry",
      });
    }
  });
}
