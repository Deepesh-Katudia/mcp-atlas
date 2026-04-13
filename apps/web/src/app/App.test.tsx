import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import type { DashboardSnapshot } from "@mcp-atlas/contracts";

const dashboardSnapshot: DashboardSnapshot = {
  generatedAt: 1,
  overview: {
    totalServers: 4,
    activeServers: 4,
    requestsLastMinute: 12,
    averageLatencyMs: 120,
    failedRequests: 0,
    anomalyCount: 1,
  },
  servers: [],
  toolsets: [],
  traces: [],
  dependencies: [],
  alerts: [],
  timeseries: [],
};

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const payload = url.includes("/api/integrations/blaxel/functions")
          ? { ok: true, functions: [] }
          : dashboardSnapshot;

        return {
          text: async () => JSON.stringify(payload),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders dashboard navigation links", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /topology/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /health/i })).toBeInTheDocument();
  });
});
