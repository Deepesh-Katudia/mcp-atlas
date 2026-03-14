export interface ServerStats {
  name: string;
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
  source: string;
  target: string | null;
  latencyMs: number;
  status: "ok" | "error" | "info";
  timestamp: number;
  errorMessage: string | null;
  eventType: string;
}

export interface TraceSummary {
  traceId: string;
  requestId: string;
  origin: string;
  path: string[];
  totalLatencyMs: number;
  status: "running" | "success" | "failed";
  startedAt: number;
  updatedAt: number;
  hops: TraceHop[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  volume: number;
  averageLatencyMs: number;
}

export interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  kind: "latency" | "failure" | "loop" | "routing";
  title: string;
  detail: string;
  server: string | null;
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
  traces: TraceSummary[];
  dependencies: DependencyEdge[];
  alerts: Alert[];
  timeseries: TimeseriesPoint[];
}

export interface BlaxelFunctionRecord {
  name: string;
  displayName: string;
  transport: string;
  url: string | null;
  enabled: boolean;
  status: string;
}

export interface BlaxelToolRecord {
  name: string;
  description?: string;
}
