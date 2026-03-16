export const eventTypes = [
  "REQUEST_RECEIVED",
  "REQUEST_FORWARDED",
  "REQUEST_COMPLETED",
  "REQUEST_FAILED",
  "HEARTBEAT",
] as const;

export type EventType = (typeof eventTypes)[number];

export type EventStatus = "ok" | "error" | "info";

export type McpName = "Gateway MCP" | "Search MCP" | "Memory MCP" | "File MCP" | "Atlas Blaxel MCP";

export interface TelemetryEvent {
  eventId: string;
  traceId: string;
  requestId: string;
  timestamp: number;
  sourceMcp: McpName;
  targetMcp: McpName | null;
  eventType: EventType;
  status: EventStatus;
  latencyMs: number;
  errorMessage: string | null;
}

export interface ServerStats {
  name: McpName;
  status: "online" | "degraded" | "offline";
  heartbeatAt: number;
  requestsPerMinute: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  throughput: number;
  inFlight: number;
}

export interface TraceHop {
  source: McpName;
  target: McpName | null;
  latencyMs: number;
  status: EventStatus;
  timestamp: number;
  errorMessage: string | null;
  eventType: EventType;
}

export interface TraceSummary {
  traceId: string;
  requestId: string;
  origin: McpName;
  path: string[];
  totalLatencyMs: number;
  status: "running" | "success" | "failed";
  startedAt: number;
  updatedAt: number;
  hops: TraceHop[];
}

export interface DependencyEdge {
  source: McpName;
  target: McpName;
  volume: number;
  averageLatencyMs: number;
}

export interface McpToolInfo {
  id: string;
  name: string;
  description: string | null;
  requestCount: number;
  averageLatencyMs: number;
}

export interface McpToolset {
  server: McpName;
  tools: McpToolInfo[];
}

export interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  kind: "latency" | "failure" | "loop" | "routing";
  title: string;
  detail: string;
  server: McpName | null;
  timestamp: number;
}

export interface OverviewStats {
  totalServers: number;
  activeServers: number;
  requestsLastMinute: number;
  averageLatencyMs: number;
  failedRequests: number;
  anomalyCount: number;
}

export interface TimeseriesPoint {
  timestamp: number;
  requests: number;
  failures: number;
  averageLatencyMs: number;
}

export interface DashboardSnapshot {
  generatedAt: number;
  overview: OverviewStats;
  servers: ServerStats[];
  toolsets: McpToolset[];
  traces: TraceSummary[];
  dependencies: DependencyEdge[];
  alerts: Alert[];
  timeseries: TimeseriesPoint[];
}
