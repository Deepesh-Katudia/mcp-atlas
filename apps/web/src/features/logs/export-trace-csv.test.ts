import { describe, expect, it } from "vitest";
import type { TraceSummary } from "@mcp-atlas/contracts";
import { buildTraceCsv } from "./export-trace-csv";

describe("buildTraceCsv", () => {
  it("serializes a trace with escaped values and one row per hop", () => {
    const trace: TraceSummary = {
      traceId: "trace-1",
      requestId: 'req "alpha"',
      origin: "gateway",
      path: ["Gateway MCP", "Search MCP"],
      totalLatencyMs: 46,
      status: "failed",
      startedAt: 1700000000000,
      updatedAt: 1700000003000,
      hops: [
        {
          source: "Gateway MCP",
          target: "Search MCP",
          latencyMs: 12,
          status: "ok",
          timestamp: 1700000001000,
          errorMessage: null,
          eventType: "REQUEST_RECEIVED",
        },
        {
          source: "Search MCP",
          target: null,
          latencyMs: 34,
          status: "error",
          timestamp: 1700000002000,
          errorMessage: 'bad "thing"',
          eventType: "REQUEST_FAILED",
        },
      ],
    };

    expect(buildTraceCsv(trace)).toBe(
      [
        '"trace_id","request_id","origin","trace_status","hop_index","event_type","source","target","hop_status","latency_ms","timestamp","error_message","path"',
        '"trace-1","req ""alpha""","gateway","failed","1","REQUEST_RECEIVED","Gateway MCP","Search MCP","ok","12","2023-11-14T22:13:21.000Z","","Gateway MCP -> Search MCP"',
        '"trace-1","req ""alpha""","gateway","failed","2","REQUEST_FAILED","Search MCP","","error","34","2023-11-14T22:13:22.000Z","bad ""thing""","Gateway MCP -> Search MCP"',
      ].join("\n"),
    );
  });
});
