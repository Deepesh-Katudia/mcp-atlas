import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

describe("App", () => {
  it("renders the shell landmarks, mobile navigation trigger, page header, and summary metrics", () => {
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

    const toggle = screen.getByRole("button", { name: /open navigation/i });
    const sidebar = screen.getByRole("complementary", { name: /primary navigation/i });
    const main = screen.getByRole("main");

    expect(toggle).toHaveAttribute("aria-controls", "primary-sidebar");
    expect(sidebar).toHaveAttribute("id", "primary-sidebar");
    expect(screen.getByText("MCP Atlas")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /topology/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /logs/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /health/i })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: /operations overview/i })).toBeInTheDocument();
    const summary = within(main).getByRole("region", { name: /dashboard summary/i });
    expect(within(summary).getByText("Active Servers")).toBeInTheDocument();
    expect(within(summary).getByText("4/4")).toBeInTheDocument();
  });

  it("keeps responsive shell and summary collapse rules in the shared stylesheet", () => {
    const styles = readFileSync("src/styles.css", "utf8");

    expect(styles).toMatch(/@media \(max-width: 900px\)/);
    expect(styles).toMatch(/@media \(max-width: 900px\)[\s\S]*\.page-header-actions\s*\{[\s\S]*min-width:\s*0;[\s\S]*width:\s*100%;/);
    expect(styles).toMatch(/@media \(max-width: 1100px\)[\s\S]*\.logs-workspace-list,\s*\.logs-workspace-detail[\s\S]*min-height:\s*auto;/);
  });
});
