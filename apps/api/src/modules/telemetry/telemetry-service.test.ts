import { describe, expect, it } from "vitest";
import { TelemetryService } from "./telemetry-service.js";

describe("TelemetryService", () => {
  it("builds a dashboard snapshot from ingested events", () => {
    const telemetry = new TelemetryService();

    telemetry.ingest({
      eventId: "evt-1",
      traceId: "trace-1",
      requestId: "req-1",
      timestamp: Date.now(),
      sourceMcp: "Gateway MCP",
      targetMcp: "Search MCP",
      eventType: "REQUEST_FORWARDED",
      status: "ok",
      latencyMs: 120,
      errorMessage: null,
    });

    const snapshot = telemetry.snapshot();

    expect(snapshot.dependencies).toEqual([
      expect.objectContaining({
        source: "Gateway MCP",
        target: "Search MCP",
        volume: 1,
      }),
    ]);
  });
});
