import type { TraceSummary } from "@mcp-atlas/contracts";
import { formatDateForFile } from "../shared/dashboard-formatters";

function escapeCsvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildTraceCsv(trace: TraceSummary) {
  const headers = [
    "trace_id",
    "request_id",
    "origin",
    "trace_status",
    "hop_index",
    "event_type",
    "source",
    "target",
    "hop_status",
    "latency_ms",
    "timestamp",
    "error_message",
    "path",
  ];

  const rows = trace.hops.map((hop, index) => [
    trace.traceId,
    trace.requestId,
    trace.origin,
    trace.status,
    String(index + 1),
    hop.eventType,
    hop.source,
    hop.target ?? "",
    hop.status,
    String(hop.latencyMs),
    new Date(hop.timestamp).toISOString(),
    hop.errorMessage ?? "",
    trace.path.join(" -> "),
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

export function exportTraceCsv(trace: TraceSummary) {
  const csv = buildTraceCsv(trace);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${trace.requestId}-${formatDateForFile(trace.updatedAt)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
