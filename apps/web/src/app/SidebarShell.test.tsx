import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

  it("opens the mobile navigation and closes it after navigating to another route", async () => {
    render(
      <MemoryRouter initialEntries={["/logs"]}>
        <Routes>
          <Route
            path="*"
            element={
              <SidebarShell
                generatedAt={1713124800000}
                overview={{
                  activeServers: 3,
                  totalServers: 4,
                  requestsLastMinute: 18,
                  averageLatencyMs: 82,
                  failedRequests: 0,
                  anomalyCount: 1,
                }}
              >
                <div>child content</div>
              </SidebarShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: /open navigation/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/primary navigation/i)).toHaveClass("sidebar-shell-open");

    fireEvent.click(screen.getByRole("link", { name: /health/i }));

    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
    expect(screen.getByRole("link", { name: /health/i })).toHaveAttribute("aria-current", "page");
  });
});
