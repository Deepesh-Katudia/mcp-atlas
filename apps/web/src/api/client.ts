import type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";
import type { BlaxelFunctionRecord, BlaxelToolRecord } from "../types";

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.startsWith("<!DOCTYPE")
        ? "API returned HTML instead of JSON. Make sure the Atlas server is running on port 4000 and restart the Vite frontend."
        : text || "Invalid JSON response",
    );
  }
}

async function get<T>(path: string) {
  const response = await fetch(`${apiBase}${path}`);
  return readJsonResponse<T>(response);
}

async function post<T>(path: string, body: unknown) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await readJsonResponse<T>(response),
  };
}

export const apiClient = {
  getSnapshot() {
    return get<DashboardSnapshot>("/api/snapshot");
  },
  getTraces() {
    return get<TraceSummary[]>("/api/traces");
  },
  getBlaxelFunctions() {
    return get<{ ok: boolean; functions?: BlaxelFunctionRecord[] }>("/api/integrations/blaxel/functions");
  },
  testBlaxelFunction(functionName: string) {
    return get<{ ok: boolean; toolCount?: number; error?: string }>(
      `/api/integrations/blaxel/functions/${functionName}/test`,
    );
  },
  getBlaxelTools(functionName: string) {
    return get<{ ok: boolean; tools?: BlaxelToolRecord[]; error?: string }>(
      `/api/integrations/blaxel/functions/${functionName}/tools`,
    );
  },
  triggerAgentTask(query = "multi mcp observability") {
    return post<{ traceId?: string; error?: string }>("/api/controls/agent-task", { query });
  },
  triggerSearch(query = "alignment dashboard") {
    return post<{ traceId?: string; error?: string }>("/api/controls/mcps/search-mcp/tools/search", { query });
  },
  triggerFailure(query = "failing file path") {
    return post<{ traceId?: string; error?: string }>("/api/controls/failure", { query });
  },
  triggerBlaxelProcessesList() {
    return post<{ traceId?: string; error?: string }>("/api/controls/blaxel/processes-list", {});
  },
};
