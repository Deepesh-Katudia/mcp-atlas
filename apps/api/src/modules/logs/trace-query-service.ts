import type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";

export class TraceQueryService {
  list(snapshot: DashboardSnapshot): TraceSummary[] {
    return snapshot.traces;
  }

  getById(snapshot: DashboardSnapshot, traceId: string) {
    return snapshot.traces.find((trace) => trace.traceId === traceId) ?? null;
  }
}
