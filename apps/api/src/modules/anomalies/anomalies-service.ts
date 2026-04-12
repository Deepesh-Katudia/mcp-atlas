import type { Alert, DashboardSnapshot } from "@mcp-atlas/contracts";

export class AnomaliesService {
  list(snapshot: DashboardSnapshot): Alert[] {
    return snapshot.alerts;
  }
}
