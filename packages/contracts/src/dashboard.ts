import { z } from "zod";

export const EventTypeSchema = z.enum([
  "REQUEST_RECEIVED",
  "REQUEST_FORWARDED",
  "REQUEST_COMPLETED",
  "REQUEST_FAILED",
  "HEARTBEAT",
]);

export const EventStatusSchema = z.enum(["ok", "error", "info"]);

export const McpNameSchema = z.enum([
  "Gateway MCP",
  "Search MCP",
  "Memory MCP",
  "File MCP",
  "Atlas Blaxel MCP",
]);

export const McpToolInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  requestCount: z.number(),
  averageLatencyMs: z.number(),
});

export const McpToolsetSchema = z.object({
  server: z.string(),
  tools: z.array(McpToolInfoSchema),
});

export const ServerStatsSchema = z.object({
  name: z.string(),
  status: z.enum(["online", "degraded", "offline"]),
  heartbeatAt: z.number(),
  requestsPerMinute: z.number(),
  averageLatencyMs: z.number(),
  p95LatencyMs: z.number(),
  errorRate: z.number(),
  throughput: z.number(),
  inFlight: z.number(),
});

export const TraceHopSchema = z.object({
  source: z.string(),
  target: z.string().nullable(),
  latencyMs: z.number(),
  status: EventStatusSchema,
  timestamp: z.number(),
  errorMessage: z.string().nullable(),
  eventType: EventTypeSchema,
});

export const TraceSummarySchema = z.object({
  traceId: z.string(),
  requestId: z.string(),
  origin: z.string(),
  path: z.array(z.string()),
  totalLatencyMs: z.number(),
  status: z.enum(["running", "success", "failed"]),
  startedAt: z.number(),
  updatedAt: z.number(),
  hops: z.array(TraceHopSchema),
});

export const DependencyEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  volume: z.number(),
  averageLatencyMs: z.number(),
});

export const AlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  kind: z.enum(["latency", "failure", "loop", "routing"]),
  title: z.string(),
  detail: z.string(),
  server: z.string().nullable(),
  timestamp: z.number(),
});

export const OverviewStatsSchema = z.object({
  totalServers: z.number(),
  activeServers: z.number(),
  requestsLastMinute: z.number(),
  averageLatencyMs: z.number(),
  failedRequests: z.number(),
  anomalyCount: z.number(),
});

export const TimeseriesPointSchema = z.object({
  timestamp: z.number(),
  requests: z.number(),
  failures: z.number(),
  averageLatencyMs: z.number(),
});

export const DashboardSnapshotSchema = z.object({
  generatedAt: z.number(),
  overview: OverviewStatsSchema,
  servers: z.array(ServerStatsSchema),
  toolsets: z.array(McpToolsetSchema),
  traces: z.array(TraceSummarySchema),
  dependencies: z.array(DependencyEdgeSchema),
  alerts: z.array(AlertSchema),
  timeseries: z.array(TimeseriesPointSchema),
});

export const McpRegistryRecordSchema = z.object({
  slug: z.string(),
  name: z.string(),
  transport: z.string(),
  status: z.enum(["online", "degraded", "offline", "configured"]),
  tools: z.array(McpToolInfoSchema),
  url: z.string().nullable().optional(),
});

export const TelemetryEventSchema = z.object({
  eventId: z.string(),
  traceId: z.string(),
  requestId: z.string(),
  timestamp: z.number(),
  sourceMcp: McpNameSchema,
  targetMcp: McpNameSchema.nullable(),
  eventType: EventTypeSchema,
  status: EventStatusSchema,
  latencyMs: z.number(),
  errorMessage: z.string().nullable(),
});

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventStatus = z.infer<typeof EventStatusSchema>;
export type McpName = z.infer<typeof McpNameSchema>;
export type McpToolInfo = z.infer<typeof McpToolInfoSchema>;
export type McpToolset = z.infer<typeof McpToolsetSchema>;
export type ServerStats = z.infer<typeof ServerStatsSchema>;
export type TraceHop = z.infer<typeof TraceHopSchema>;
export type TraceSummary = z.infer<typeof TraceSummarySchema>;
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type OverviewStats = z.infer<typeof OverviewStatsSchema>;
export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
export type McpRegistryRecord = z.infer<typeof McpRegistryRecordSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
