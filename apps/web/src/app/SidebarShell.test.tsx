import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarShell } from "./SidebarShell";

describe("SidebarShell", () => {
  it("renders primary navigation, active logs state, branding, snapshot status, and children", () => {
    render(
      <MemoryRouter initialEntries={["/logs"]}>
        <SidebarShell generatedAt={1713124800000} overview={{ activeServers: 3, totalServers: 4, requestsLastMinute: 18, averageLatencyMs: 82, failedRequests: 0, anomalyCount: 1 }}>
          <div>child content</div>
        </SidebarShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("MCP Atlas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /topology/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /logs/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /health/i })).toBeInTheDocument();
    expect(screen.getByText(/live snapshot/i)).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
