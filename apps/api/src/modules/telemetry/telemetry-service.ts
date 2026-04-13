import type { DashboardSnapshot, TelemetryEvent } from "@mcp-atlas/contracts";
import { TelemetryStore } from "../../store.js";

export class TelemetryService {
  constructor(
    private readonly store = new TelemetryStore(),
    private readonly snapshotDecorator: (snapshot: DashboardSnapshot) => DashboardSnapshot = (snapshot) => snapshot,
  ) {}

  ingest(event: TelemetryEvent) {
    this.store.ingest(event);
  }

  snapshot(): DashboardSnapshot {
    return this.snapshotDecorator(this.store.snapshot());
  }
}
