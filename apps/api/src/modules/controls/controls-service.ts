import type { TelemetryEvent } from "@mcp-atlas/contracts";
import type { McpName } from "../../types.js";

const knownMcpNames = new Set<McpName>([
  "Gateway MCP",
  "Search MCP",
  "Memory MCP",
  "File MCP",
  "Atlas Blaxel MCP",
]);

interface CallOptions {
  sourceMcp?: McpName;
  traceId?: string;
  requestId?: string;
}

export class ControlsService {
  private sequence = 0;

  constructor(
    private readonly deps: {
      registry: {
        getAdapter(slug: string): {
          describeServer(): { name: string };
          callTool(name: string, payload: Record<string, unknown>): Promise<unknown>;
        } | null;
      };
      telemetry: { ingest(event: TelemetryEvent): void };
      recordToolInvocation?: (entry: {
        server: McpName;
        toolId: string;
        latencyMs: number;
        status: "ok" | "error";
      }) => void;
    },
  ) {}

  async callMcpTool(slug: string, toolName: string, payload: Record<string, unknown>, options: CallOptions = {}) {
    const { result } = await this.executeMcpTool(slug, toolName, payload, options);
    return result;
  }

  async proxyMcpTool(slug: string, toolName: string, payload: Record<string, unknown>) {
    const { traceId, requestId, targetName, result } = await this.executeMcpTool(slug, toolName, payload);
    return {
      traceId,
      requestId,
      target: targetName,
      data: result,
    };
  }

  private async executeMcpTool(slug: string, toolName: string, payload: Record<string, unknown>, options: CallOptions = {}) {
    const adapter = this.deps.registry.getAdapter(slug);
    if (!adapter) {
      throw new Error(`Unknown MCP adapter: ${slug}`);
    }

    const sourceMcp = options.sourceMcp ?? "Gateway MCP";
    const targetName = this.asMcpName(adapter.describeServer().name);
    const traceId = options.traceId ?? this.nextId("trace");
    const requestId = options.requestId ?? this.nextId("req");
    const startedAt = Date.now();

    this.deps.telemetry.ingest({
      eventId: this.nextId("evt"),
      traceId,
      requestId,
      timestamp: startedAt,
      sourceMcp,
      targetMcp: targetName,
      eventType: "REQUEST_RECEIVED",
      status: "info",
      latencyMs: 0,
      errorMessage: null,
    });

    try {
      const result = await adapter.callTool(toolName, payload);
      const latencyMs = Date.now() - startedAt;

      this.deps.recordToolInvocation?.({
        server: targetName,
        toolId: toolName,
        latencyMs,
        status: "ok",
      });

      this.deps.telemetry.ingest({
        eventId: this.nextId("evt"),
        traceId,
        requestId,
        timestamp: Date.now(),
        sourceMcp,
        targetMcp: targetName,
        eventType: "REQUEST_FORWARDED",
        status: "ok",
        latencyMs,
        errorMessage: null,
      });

      this.deps.telemetry.ingest({
        eventId: this.nextId("evt"),
        traceId,
        requestId,
        timestamp: Date.now(),
        sourceMcp: targetName,
        targetMcp: null,
        eventType: "REQUEST_COMPLETED",
        status: "ok",
        latencyMs,
        errorMessage: null,
      });

      return { traceId, requestId, targetName, result };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;

      this.deps.recordToolInvocation?.({
        server: targetName,
        toolId: toolName,
        latencyMs,
        status: "error",
      });

      this.deps.telemetry.ingest({
        eventId: this.nextId("evt"),
        traceId,
        requestId,
        timestamp: Date.now(),
        sourceMcp: targetName,
        targetMcp: null,
        eventType: "REQUEST_FAILED",
        status: "error",
        latencyMs,
        errorMessage: error instanceof Error ? error.message : "Unknown MCP error",
      });

      throw error;
    }
  }

  async runAgentTask(payload: { query?: string; forceFileFailure?: boolean } = {}) {
    const traceId = this.nextId("trace");
    const requestId = this.nextId("req");
    const query = String(payload.query ?? "alignment observability");
    const forceFileFailure = Boolean(payload.forceFileFailure);
    const startedAt = Date.now();

    try {
      const search = await this.executeMcpTool(
        "search-mcp",
        "search",
        { query },
        { sourceMcp: "Gateway MCP", traceId, requestId },
      );
      const memory = await this.executeMcpTool(
        "memory-mcp",
        "memory",
        { topic: query, userId: "u1" },
        { sourceMcp: "Search MCP", traceId, requestId },
      );
      const file = await this.executeMcpTool(
        "file-mcp",
        "file",
        { filename: "atlas-notes.txt", forceFailure: forceFileFailure },
        { sourceMcp: "Memory MCP", traceId, requestId },
      );

      this.deps.recordToolInvocation?.({
        server: "Gateway MCP",
        toolId: "agent-task",
        latencyMs: Date.now() - startedAt,
        status: "ok",
      });

      return {
        traceId,
        requestId,
        result: {
          search: search.result,
          memory: memory.result,
          file: file.result,
        },
      };
    } catch (error) {
      this.deps.recordToolInvocation?.({
        server: "Gateway MCP",
        toolId: "agent-task",
        latencyMs: Date.now() - startedAt,
        status: "error",
      });

      throw error instanceof Error ? error : new Error("Agent task failed");
    }
  }

  async runFailureScenario(payload: { query?: string } = {}) {
    return this.runAgentTask({
      query: payload.query ?? "failing file path",
      forceFileFailure: true,
    });
  }

  async runBlaxelProcessesList() {
    const { traceId, requestId, result } = await this.executeMcpTool("atlas-blaxel-mcp", "processesList", {});
    return {
      ok: true,
      traceId,
      requestId,
      result,
    };
  }

  private nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private asMcpName(name: string): McpName {
    if (!knownMcpNames.has(name as McpName)) {
      throw new Error(`Unsupported MCP name: ${name}`);
    }

    return name as McpName;
  }
}
