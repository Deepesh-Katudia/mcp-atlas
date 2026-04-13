import type { Express } from "express";
import type { ApiRuntime } from "../app/runtime.js";

export function registerSnapshotRoutes(
  app: Express,
  services: ApiRuntime["services"],
) {
  app.get("/api/snapshot", (_req, res) => {
    res.json(services.telemetry.snapshot());
  });

  app.get("/api/topology", (_req, res) => {
    res.json(services.topology.fromSnapshot(services.telemetry.snapshot()));
  });

  app.get("/api/anomalies", (_req, res) => {
    res.json(services.anomalies.list(services.telemetry.snapshot()));
  });

  app.get("/api/traces", (_req, res) => {
    res.json(services.traces.list(services.telemetry.snapshot()));
  });

  app.get("/api/traces/:traceId", (req, res) => {
    const trace = services.traces.getById(services.telemetry.snapshot(), req.params.traceId);
    if (!trace) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }

    res.json(trace);
  });
}
