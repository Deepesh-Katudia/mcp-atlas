import type {
  Alert,
  DashboardSnapshot,
  DependencyEdge,
  McpName,
  ServerStats,
  TelemetryEvent,
  TimeseriesPoint,
  TraceSummary,
} from "./types.js";

const serverNames: McpName[] = [
  "Gateway MCP",
  "Search MCP",
  "Memory MCP",
  "File MCP",
  "Atlas Blaxel MCP",
];

const serverDegradedP95Ms = 650;
const serverLatencyAlertMs = 550;
const slowHopAlertMs = 450;
const slowTraceAlertMs = 1200;

interface TraceAccumulator {
  traceId: string;
  requestId: string;
  origin: McpName;
  hops: TraceSummary["hops"];
  startedAt: number;
  updatedAt: number;
}

export class TelemetryStore {
  private readonly events: TelemetryEvent[] = [];
  private readonly heartbeats = new Map<McpName, number>();
  private readonly traces = new Map<string, TraceAccumulator>();

  ingest(event: TelemetryEvent) {
    this.events.push(event);
    if (this.events.length > 5000) {
      this.events.splice(0, this.events.length - 5000);
    }

    if (event.eventType === "HEARTBEAT") {
      this.heartbeats.set(event.sourceMcp, event.timestamp);
      return;
    }

    const trace = this.traces.get(event.traceId) ?? {
      traceId: event.traceId,
      requestId: event.requestId,
      origin: event.sourceMcp,
      hops: [],
      startedAt: event.timestamp,
      updatedAt: event.timestamp,
    };

    trace.hops.push({
      source: event.sourceMcp,
      target: event.targetMcp,
      latencyMs: event.latencyMs,
      status: event.status,
      timestamp: event.timestamp,
      errorMessage: event.errorMessage,
      eventType: event.eventType,
    });
    trace.updatedAt = event.timestamp;
    this.traces.set(event.traceId, trace);

    if (this.traces.size > 250) {
      const oldest = [...this.traces.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
      if (oldest) {
        this.traces.delete(oldest.traceId);
      }
    }
  }

  snapshot(now = Date.now()): DashboardSnapshot {
    const recentEvents = this.events.filter((event) => now - event.timestamp <= 60_000);
    const requestEvents = recentEvents.filter((event) => event.eventType !== "HEARTBEAT");
    const terminalEvents = requestEvents.filter(
      (event) => event.eventType === "REQUEST_COMPLETED" || event.eventType === "REQUEST_FAILED",
    );

    const servers = serverNames.map((name) => this.buildServerStats(name, recentEvents, now));
    const traces = [...this.traces.values()]
      .map((trace) => this.buildTraceSummary(trace))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
    const dependencies = this.buildDependencyGraph(requestEvents);
    const alerts = this.buildAlerts(now, servers, traces);
    const averageLatencyMs =
      terminalEvents.length > 0
        ? Math.round(terminalEvents.reduce((sum, event) => sum + event.latencyMs, 0) / terminalEvents.length)
        : 0;

    return {
      generatedAt: now,
      overview: {
        totalServers: servers.length,
        activeServers: servers.filter((server) => server.status !== "offline").length,
        requestsLastMinute: terminalEvents.length,
        averageLatencyMs,
        failedRequests: terminalEvents.filter((event) => event.status === "error").length,
        anomalyCount: alerts.length,
      },
      servers,
      traces,
      dependencies,
      alerts,
      timeseries: this.buildTimeseries(now),
    };
  }

  private buildServerStats(name: McpName, recentEvents: TelemetryEvent[], now: number): ServerStats {
    const events = recentEvents.filter(
      (event) => event.sourceMcp === name && event.eventType !== "HEARTBEAT",
    );
    const received = recentEvents.filter(
      (event) => event.targetMcp === name && event.eventType === "REQUEST_RECEIVED",
    );
    const terminal = events.filter(
      (event) => event.eventType === "REQUEST_COMPLETED" || event.eventType === "REQUEST_FAILED",
    );
    const heartbeatAt = this.heartbeats.get(name) ?? 0;
    const millisSinceHeartbeat = heartbeatAt === 0 ? Number.POSITIVE_INFINITY : now - heartbeatAt;
    const averageLatencyMs =
      terminal.length > 0
        ? Math.round(terminal.reduce((sum, event) => sum + event.latencyMs, 0) / terminal.length)
        : 0;
    const p95LatencyMs = this.percentile(
      terminal.map((event) => event.latencyMs),
      0.95,
    );
    const errorRate = terminal.length > 0 ? terminal.filter((event) => event.status === "error").length / terminal.length : 0;
    let status: ServerStats["status"] = "online";

    if (millisSinceHeartbeat > 12_000) {
      status = "offline";
    } else if (errorRate > 0.15 || p95LatencyMs > serverDegradedP95Ms) {
      status = "degraded";
    }

    return {
      name,
      status,
      heartbeatAt,
      requestsPerMinute: terminal.length,
      averageLatencyMs,
      p95LatencyMs,
      errorRate: Number(errorRate.toFixed(2)),
      throughput: terminal.length,
      inFlight: Math.max(0, received.length - terminal.length),
    };
  }

  private buildTraceSummary(trace: TraceAccumulator): TraceSummary {
    const path = [trace.origin];
    for (const hop of trace.hops) {
      if (hop.target && path[path.length - 1] !== hop.target) {
        path.push(hop.target);
      }
    }

    const hasFailure = trace.hops.some((hop) => hop.eventType === "REQUEST_FAILED");
    const hasCompletion = trace.hops.some((hop) => hop.eventType === "REQUEST_COMPLETED");

    return {
      traceId: trace.traceId,
      requestId: trace.requestId,
      origin: trace.origin,
      path,
      totalLatencyMs: trace.hops.reduce((sum, hop) => sum + hop.latencyMs, 0),
      status: hasFailure ? "failed" : hasCompletion ? "success" : "running",
      startedAt: trace.startedAt,
      updatedAt: trace.updatedAt,
      hops: trace.hops,
    };
  }

  private buildDependencyGraph(events: TelemetryEvent[]): DependencyEdge[] {
    const edges = new Map<string, { source: McpName; target: McpName; volume: number; totalLatencyMs: number }>();
    for (const event of events) {
      if (!event.targetMcp || event.eventType !== "REQUEST_FORWARDED") {
        continue;
      }
      const key = `${event.sourceMcp}->${event.targetMcp}`;
      const edge = edges.get(key) ?? {
        source: event.sourceMcp,
        target: event.targetMcp,
        volume: 0,
        totalLatencyMs: 0,
      };
      edge.volume += 1;
      edge.totalLatencyMs += event.latencyMs;
      edges.set(key, edge);
    }

    return [...edges.values()]
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        volume: edge.volume,
        averageLatencyMs: Math.round(edge.totalLatencyMs / edge.volume),
      }))
      .sort((a, b) => b.volume - a.volume);
  }

  private buildAlerts(now: number, servers: ServerStats[], traces: TraceSummary[]): Alert[] {
    const alerts: Alert[] = [];
    for (const server of servers) {
      if (server.status === "offline") {
        alerts.push({
          id: `${server.name}-offline`,
          severity: "high",
          kind: "failure",
          title: `${server.name} is offline`,
          detail: `No heartbeat for ${Math.round((now - server.heartbeatAt) / 1000)}s.`,
          server: server.name,
          timestamp: now,
        });
      } else if (server.p95LatencyMs > serverLatencyAlertMs) {
        alerts.push({
          id: `${server.name}-latency`,
          severity: "medium",
          kind: "latency",
          title: `${server.name} latency spike`,
          detail: `p95 latency is ${server.p95LatencyMs}ms in the last minute.`,
          server: server.name,
          timestamp: now,
        });
      }

      if (server.errorRate >= 0.2 && server.requestsPerMinute >= 3) {
        alerts.push({
          id: `${server.name}-errors`,
          severity: "high",
          kind: "failure",
          title: `${server.name} elevated failure rate`,
          detail: `${Math.round(server.errorRate * 100)}% of recent requests failed.`,
          server: server.name,
          timestamp: now,
        });
      }
    }

    for (const trace of traces) {
      if (trace.status === "failed") {
        const lastFailure = [...trace.hops].reverse().find((hop) => hop.eventType === "REQUEST_FAILED");
        alerts.push({
          id: `${trace.traceId}-failed`,
          severity: "high",
          kind: "failure",
          title: `Failed trace ${trace.requestId}`,
          detail: lastFailure?.errorMessage ?? `Trace failed after ${trace.totalLatencyMs}ms.`,
          server: lastFailure?.source ?? null,
          timestamp: trace.updatedAt,
        });
      }

      const slowHop = trace.hops.find(
        (hop) =>
          (hop.eventType === "REQUEST_FORWARDED" || hop.eventType === "REQUEST_COMPLETED") &&
          hop.latencyMs >= slowHopAlertMs,
      );
      if (slowHop) {
        alerts.push({
          id: `${trace.traceId}-slow-hop-${slowHop.source}-${slowHop.target ?? "terminal"}`,
          severity: slowHop.latencyMs >= 700 ? "high" : "medium",
          kind: "latency",
          title: `Slow hop in ${trace.requestId}`,
          detail: `${slowHop.source}${slowHop.target ? ` -> ${slowHop.target}` : ""} took ${slowHop.latencyMs}ms.`,
          server: slowHop.source,
          timestamp: slowHop.timestamp,
        });
      }

      if (this.hasLoop(trace.path)) {
        alerts.push({
          id: `${trace.traceId}-loop`,
          severity: "high",
          kind: "loop",
          title: `Loop detected in ${trace.requestId}`,
          detail: `Trace revisits a server: ${trace.path.join(" -> ")}.`,
          server: null,
          timestamp: trace.updatedAt,
        });
      }

      if (trace.path.length >= 5) {
        alerts.push({
          id: `${trace.traceId}-routing`,
          severity: "low",
          kind: "routing",
          title: `Long dependency chain in ${trace.requestId}`,
          detail: `Trace spans ${trace.path.length} MCP servers.`,
          server: null,
          timestamp: trace.updatedAt,
        });
      }

      if (trace.totalLatencyMs >= slowTraceAlertMs) {
        alerts.push({
          id: `${trace.traceId}-slow-trace`,
          severity: trace.totalLatencyMs >= 1800 ? "high" : "medium",
          kind: "routing",
          title: `Slow end-to-end trace ${trace.requestId}`,
          detail: `Trace took ${trace.totalLatencyMs}ms across ${trace.path.length} MCPs.`,
          server: null,
          timestamp: trace.updatedAt,
        });
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  }

  private buildTimeseries(now: number): TimeseriesPoint[] {
    const buckets = Array.from({ length: 12 }, (_, index) => now - (11 - index) * 5_000);
    return buckets.map((bucketStart) => {
      const bucketEnd = bucketStart + 5_000;
      const bucketEvents = this.events.filter(
        (event) =>
          event.timestamp >= bucketStart &&
          event.timestamp < bucketEnd &&
          (event.eventType === "REQUEST_COMPLETED" || event.eventType === "REQUEST_FAILED"),
      );
      const averageLatencyMs =
        bucketEvents.length > 0
          ? Math.round(bucketEvents.reduce((sum, event) => sum + event.latencyMs, 0) / bucketEvents.length)
          : 0;
      return {
        timestamp: bucketStart,
        requests: bucketEvents.length,
        failures: bucketEvents.filter((event) => event.status === "error").length,
        averageLatencyMs,
      };
    });
  }

  private percentile(values: number[], ratio: number) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
    return sorted[index];
  }

  private hasLoop(path: string[]) {
    return new Set(path).size !== path.length;
  }
}
