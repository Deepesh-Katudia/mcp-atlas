import cors from "cors";
import express from "express";
import { registerCompatibilityRoutes } from "../routes/compatibility-routes.js";
import { registerControlRoutes } from "../routes/control-routes.js";
import { registerRegistryRoutes } from "../routes/registry-routes.js";
import { registerSnapshotRoutes } from "../routes/snapshot-routes.js";
import type { ApiRuntime } from "./runtime.js";

export function createApp(runtime: ApiRuntime) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerRegistryRoutes(app, runtime.registryService);
  registerSnapshotRoutes(app, runtime.services);
  registerControlRoutes(app, runtime.controls);
  registerCompatibilityRoutes(app, runtime.compatibility);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
