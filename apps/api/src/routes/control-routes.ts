import type { Express } from "express";
import type { ApiRuntime } from "../app/runtime.js";

export function registerControlRoutes(app: Express, controls: ApiRuntime["controls"]) {
  app.post("/api/controls/mcps/:mcpSlug/tools/:toolId", async (req, res) => {
    try {
      const result = await controls.callMcpTool(req.params.mcpSlug, req.params.toolId, req.body ?? {});
      res.json(result);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Control MCP call failed",
      });
    }
  });

  app.post("/api/controls/agent-task", async (req, res) => {
    try {
      res.json(await controls.runAgentTask(req.body ?? {}));
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Agent task failed",
      });
    }
  });

  app.post("/api/controls/failure", async (req, res) => {
    try {
      res.json(await controls.runFailureScenario(req.body ?? {}));
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Failure scenario failed",
      });
    }
  });

  app.post("/api/controls/blaxel/processes-list", async (_req, res) => {
    try {
      res.json(await controls.runBlaxelProcessesList());
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Blaxel processes-list failed",
      });
    }
  });
}
