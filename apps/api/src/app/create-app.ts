import cors from "cors";
import express from "express";
import { registerCompatibilityRoutes } from "../routes/compatibility-routes.js";
import { registerRegistryRoutes } from "../routes/registry-routes.js";
import type { ApiRuntime } from "./runtime.js";

export function createApp(runtime: ApiRuntime) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerRegistryRoutes(app, runtime.registryService);
  registerCompatibilityRoutes(app, runtime.compatibility);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
