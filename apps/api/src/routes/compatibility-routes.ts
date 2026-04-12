import type { Express, Response } from "express";
import type { CompatibilityRuntime } from "../app/runtime.js";

function sendInternalError(res: Response, error: unknown, fallback: string) {
  res.status(502).json({
    ok: false,
    error: error instanceof Error ? error.message : fallback,
  });
}

export function registerCompatibilityRoutes(app: Express, compatibility: CompatibilityRuntime) {
  app.get("/api/integrations/blaxel", (_req, res) => {
    res.json(compatibility.getBlaxelStatus());
  });

  app.get("/api/integrations/blaxel/functions", async (_req, res) => {
    try {
      const functions = await compatibility.listBlaxelFunctions();
      res.json({ ok: true, functions });
    } catch (error) {
      sendInternalError(res, error, "Blaxel functions discovery failed");
    }
  });

  app.get("/api/integrations/blaxel/functions/:functionName/test", async (req, res) => {
    try {
      res.json(await compatibility.testBlaxelFunction(req.params.functionName));
    } catch (error) {
      sendInternalError(res, error, "Blaxel function MCP test failed");
    }
  });

  app.get("/api/integrations/blaxel/functions/:functionName/tools", async (req, res) => {
    try {
      res.json(await compatibility.listBlaxelTools(req.params.functionName));
    } catch (error) {
      sendInternalError(res, error, "Blaxel function tool discovery failed");
    }
  });

  app.post("/api/integrations/blaxel/functions/:functionName/tools/:toolName", async (req, res) => {
    try {
      res.json(
        await compatibility.callBlaxelFunctionTool(
          req.params.functionName,
          req.params.toolName,
          (req.body ?? {}) as Record<string, unknown>,
        ),
      );
    } catch (error) {
      sendInternalError(res, error, "Blaxel function tool call failed");
    }
  });

  app.get("/api/integrations/blaxel/mcp/ping", async (_req, res) => {
    try {
      res.json(await compatibility.pingBlaxelMcp());
    } catch (error) {
      sendInternalError(res, error, "Blaxel MCP ping failed");
    }
  });

  app.get("/api/integrations/blaxel/mcp/tools", async (_req, res) => {
    try {
      res.json(await compatibility.listBlaxelMcpTools());
    } catch (error) {
      sendInternalError(res, error, "Blaxel MCP tools request failed");
    }
  });

  app.post("/api/integrations/blaxel/mcp/tools/:toolName", async (req, res) => {
    try {
      res.json(await compatibility.callBlaxelMcpTool(req.params.toolName, (req.body ?? {}) as Record<string, unknown>));
    } catch (error) {
      sendInternalError(res, error, "Blaxel MCP tool call failed");
    }
  });

  app.post("/api/integrations/blaxel/mcp/demo/processes-list", async (_req, res) => {
    try {
      res.json(await compatibility.runBlaxelProcessesList());
    } catch (error) {
      sendInternalError(res, error, "Blaxel sandbox demo failed");
    }
  });

  app.get("/api/services", (_req, res) => {
    res.json(compatibility.listServices());
  });

  app.post("/proxy/:mcpName", async (req, res) => {
    try {
      res.json(await compatibility.proxyRequest(req.params.mcpName, req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Proxy request failed";
      const status = message === "Unknown MCP service" ? 404 : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/demo/agent-task", async (req, res) => {
    try {
      res.json(await compatibility.runAgentTask(req.body));
    } catch (error) {
      sendInternalError(res, error, "Agent task failed");
    }
  });
}
