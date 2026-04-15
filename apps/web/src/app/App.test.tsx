import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

describe("App", () => {
  it("renders the sidebar shell with page header and summary metrics", () => {
    render(
      <MemoryRouter>
        <App
          generatedAt={1713124800000}
          overview={{
            activeServers: 4,
            totalServers: 4,
            requestsLastMinute: 12,
            averageLatencyMs: 120,
            failedRequests: 0,
            anomalyCount: 1,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
    expect(screen.getByText("MCP Atlas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /topology/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /operations overview/i })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: /dashboard summary/i });
    expect(within(summary).getByText("Active Servers")).toBeInTheDocument();
    expect(within(summary).getByText("4/4")).toBeInTheDocument();
  });
});
