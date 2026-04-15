import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { formatTime } from "./dashboard-shared";

type SidebarShellProps = {
  generatedAt?: number | null;
  overview?:
    | {
        activeServers: number;
        totalServers: number;
        requestsLastMinute: number;
        averageLatencyMs: number;
        failedRequests: number;
        anomalyCount: number;
      }
    | null;
  children?: ReactNode;
};

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/topology", label: "Topology" },
  { to: "/logs", label: "Logs" },
  { to: "/health", label: "Health" },
];

export function SidebarShell({ generatedAt = null, overview = null, children = null }: SidebarShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavigationOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="Open navigation"
        aria-controls="primary-sidebar"
        aria-expanded={navigationOpen}
        onClick={() => setNavigationOpen((current) => !current)}
      >
        Menu
      </button>

      <aside
        id="primary-sidebar"
        className={`sidebar-shell ${navigationOpen ? "sidebar-shell-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <p className="sidebar-kicker">Observability dashboard</p>
          <h1>MCP Atlas</h1>
          <p className="sidebar-description">
            Real-time visibility into request paths, MCP dependencies, and live service health.
          </p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <section className="sidebar-status" aria-label="Live snapshot">
          <div className="sidebar-status-header">
            <span className="live-dot" />
            <div>
              <p className="sidebar-status-title">Live snapshot</p>
              <p className="sidebar-status-copy">
                {generatedAt ? formatTime(generatedAt) : "Waiting for dashboard data"}
              </p>
            </div>
          </div>

          <dl className="sidebar-status-list">
            <div>
              <dt>Servers</dt>
              <dd>{overview ? `${overview.activeServers}/${overview.totalServers}` : "-"}</dd>
            </div>
            <div>
              <dt>Requests</dt>
              <dd>{overview ? String(overview.requestsLastMinute) : "-"}</dd>
            </div>
            <div>
              <dt>Anomalies</dt>
              <dd>{overview ? String(overview.anomalyCount) : "-"}</dd>
            </div>
          </dl>
        </section>
      </aside>

      <div className="app-main">{children}</div>
    </div>
  );
}
