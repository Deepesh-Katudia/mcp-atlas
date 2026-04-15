# MCP Atlas Minimalist UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MCP Atlas frontend into a white minimalist shell with a sticky sidebar, black primary actions, a summary-first Overview page, and preserved dark graph and chart surfaces.

**Architecture:** Keep the existing `apps/web` router, data client, and dashboard context. Introduce a dedicated sidebar shell and page-header layer, replace the current hero-first framing, and move page composition toward small presentational components that render inside a light shell while leaving topology, traffic charts, and trace detail on dark analysis surfaces.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, React Testing Library, Recharts, Cytoscape, plain CSS.

---

## File Structure

- Create: `apps/web/src/app/SidebarShell.tsx`
  - Shared white-shell layout with sticky sidebar, route navigation, and compact live-status summary.
- Create: `apps/web/src/app/PageHeader.tsx`
  - Small reusable page heading row with title, description, and optional actions.
- Create: `apps/web/src/app/SidebarShell.test.tsx`
  - Focused test for sidebar navigation, brand block, and live-status rendering.
- Create: `apps/web/src/features/overview/OverviewSummary.tsx`
  - Summary-first Overview composition with metrics, anomalies, quick links, compact traffic, and topology preview.
- Create: `apps/web/src/features/overview/OverviewSummary.test.tsx`
  - Test for executive-summary sections and deep-link cards.
- Create: `apps/web/src/features/logs/LogsWorkspace.tsx`
  - Two-pane logs layout with light list pane and dark trace-detail pane.
- Create: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
  - Test for export action placement and dark trace-detail surface.
- Create: `apps/web/src/pages/TopologyPage.test.tsx`
  - Test for topology page framing and cluster toggle action.
- Modify: `apps/web/src/app/App.tsx`
  - Replace hero/top-nav shell usage with `SidebarShell`; keep data-fetching and outlet context wiring intact.
- Modify: `apps/web/src/app/App.test.tsx`
  - Keep the router smoke test aligned with the new shell.
- Modify: `apps/web/src/styles.css`
  - Replace dark shell styles with the new white/black system and keep dark data-surface classes.
- Modify: `apps/web/src/pages/OverviewPage.tsx`
  - Render the new summary-first overview composition.
- Modify: `apps/web/src/pages/LogsPage.tsx`
  - Delegate to `LogsWorkspace`.
- Modify: `apps/web/src/pages/HealthPage.tsx`
  - Add page header and light-shell framing around the health grid.
- Modify: `apps/web/src/pages/TopologyPage.tsx`
  - Add page header, simplify white framing, and keep the dark graph workspace.
- Modify: `apps/web/src/features/controls/LiveTrafficControls.tsx`
  - Shift controls into white cards with black primary buttons and red destructive action styling.
- Modify: `apps/web/src/features/registry/McpRegistryPanel.tsx`
  - Present registry content as lighter summary cards inside the Overview page.
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
  - Keep the table-first layout but restyle the shell and dark chart inset.
- Modify: `apps/web/src/features/logs/TraceList.tsx`
  - Add lighter document-style list hooks.
- Modify: `apps/web/src/features/logs/TraceDetail.tsx`
  - Keep the hop timeline on a dark detail surface within the white shell.
- Modify: `apps/web/src/features/overview/OverviewCards.tsx`
  - Retire the current dashboard-heavy composition or reduce it to shared chart helpers only.
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`
  - Only adjust wrapper hooks if needed so the graph sits cleanly inside the new dark analysis panel.

### Task 1: Build The Minimalist Sidebar Shell

**Files:**
- Create: `apps/web/src/app/SidebarShell.tsx`
- Create: `apps/web/src/app/PageHeader.tsx`
- Create: `apps/web/src/app/SidebarShell.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing sidebar-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarShell } from "./SidebarShell";

it("renders the sticky sidebar navigation and live status summary", () => {
  render(
    <MemoryRouter initialEntries={["/logs"]}>
      <SidebarShell
        generatedAt={1712952000000}
        overview={{
          totalServers: 5,
          activeServers: 4,
          requestsLastMinute: 18,
          averageLatencyMs: 96,
          failedRequests: 1,
          anomalyCount: 2,
        }}
      >
        <div>Logs page body</div>
      </SidebarShell>
    </MemoryRouter>,
  );

  expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /logs/i })).toHaveClass("sidebar-link-active");
  expect(screen.getByText(/mcp atlas/i)).toBeInTheDocument();
  expect(screen.getByText(/live snapshot/i)).toBeInTheDocument();
  expect(screen.getByText("Logs page body")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- src/app/SidebarShell.test.tsx`

Expected: FAIL with `Cannot find module './SidebarShell'` or missing sidebar navigation assertions.

- [ ] **Step 3: Implement the shell and wire it into the app**

```tsx
// apps/web/src/app/SidebarShell.tsx
import type { OverviewStats } from "@mcp-atlas/contracts";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { formatTime } from "../features/shared/dashboard-formatters";

const NAV_ITEMS = [
  { to: "/", label: "Overview" },
  { to: "/topology", label: "Topology" },
  { to: "/logs", label: "Logs" },
  { to: "/health", label: "Health" },
];

export function SidebarShell({
  generatedAt,
  overview,
  children,
}: {
  generatedAt: number | null;
  overview: OverviewStats | null;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="shell-layout">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <p className="sidebar-kicker">MCP observability</p>
          <h1>MCP Atlas</h1>
          <p>Minimal control plane for traces, topology, health, and anomalies.</p>
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((current) => !current)}
        >
          Menu
        </button>

        <nav className={`sidebar-nav ${navOpen ? "sidebar-nav-open" : ""}`} aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <section className="sidebar-status">
          <p className="sidebar-status-label">Live snapshot</p>
          <strong>{generatedAt ? formatTime(generatedAt) : "Loading..."}</strong>
          <dl className="sidebar-status-grid">
            <div>
              <dt>Servers</dt>
              <dd>{overview ? `${overview.activeServers}/${overview.totalServers}` : "-"}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{overview ? `${overview.averageLatencyMs}ms` : "-"}</dd>
            </div>
          </dl>
        </section>
      </aside>

      <div className="shell-main">{children}</div>
    </div>
  );
}
```

```tsx
// apps/web/src/app/PageHeader.tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="page-kicker">MCP Atlas</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
```

```tsx
// apps/web/src/app/App.tsx
import { SidebarShell } from "./SidebarShell";

export function DashboardApp() {
  const outletContextValue: DashboardAppContextValue = {
    snapshot,
    selectedTrace,
    selectedTraceId,
    setSelectedTraceId,
    graphElements,
    blaxelFunctions,
    functionTestState,
    functionTools,
    functionToolState,
    onTestFunction: testBlaxelFunction,
    onLoadTools: loadBlaxelTools,
    actionPending: actionState.pending || !snapshot,
    actionMessage: snapshot ? actionState.message : "Loading dashboard data...",
    onRunAgentTask: () => runApiAction(() => apiClient.triggerAgentTask(), "Agent task completed", setActionState),
    onRunSearch: () => runApiAction(() => apiClient.triggerSearch(), "Search MCP called", setActionState),
    onRunFailure: () => runApiAction(() => apiClient.triggerFailure(), "Failure scenario triggered", setActionState),
    onRunBlaxelTask: () =>
      runApiAction(() => apiClient.triggerBlaxelProcessesList(), "Blaxel sandbox MCP trace completed", setActionState),
  };

  return (
    <SidebarShell generatedAt={snapshot?.generatedAt ?? null} overview={snapshot?.overview ?? null}>
      {snapshot ? <Outlet context={outletContextValue} /> : <div className="loading-panel">Loading dashboard data...</div>}
    </SidebarShell>
  );
}
```

```css
/* apps/web/src/styles.css */
.shell-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background: #ffffff;
  color: #111111;
}

.sidebar {
  position: sticky;
  top: 0;
  min-height: 100vh;
  padding: 28px 24px;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
}

.sidebar-link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  color: #111111;
  text-decoration: none;
}

.sidebar-link-active {
  background: #111111;
  color: #ffffff;
}

.sidebar-toggle {
  display: none;
}
```

- [ ] **Step 4: Run the targeted shell tests**

Run: `npm run test -w @mcp-atlas/web -- src/app/SidebarShell.test.tsx src/app/App.test.tsx`

Expected: PASS with the new sidebar-shell test and the router smoke test both green.

- [ ] **Step 5: Commit the shell slice**

```bash
git add apps/web/src/app/SidebarShell.tsx apps/web/src/app/PageHeader.tsx apps/web/src/app/SidebarShell.test.tsx apps/web/src/app/App.tsx apps/web/src/app/App.test.tsx apps/web/src/styles.css
git commit -m "feat: add minimalist sidebar shell"
```

### Task 2: Replace Overview With An Executive Summary Page

**Files:**
- Create: `apps/web/src/features/overview/OverviewSummary.tsx`
- Create: `apps/web/src/features/overview/OverviewSummary.test.tsx`
- Modify: `apps/web/src/pages/OverviewPage.tsx`
- Modify: `apps/web/src/features/controls/LiveTrafficControls.tsx`
- Modify: `apps/web/src/features/registry/McpRegistryPanel.tsx`
- Modify: `apps/web/src/features/overview/OverviewCards.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing executive-summary test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OverviewSummary } from "./OverviewSummary";

it("renders the summary-first overview with quick links and compact insights", () => {
  render(
    <MemoryRouter>
      <OverviewSummary
        snapshot={dashboardSnapshot}
        graphElements={{ flat: [], clustered: [] }}
        registryCount={2}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: /system summary/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /open topology/i })).toBeInTheDocument();
  expect(screen.getByText(/active anomalies/i)).toBeInTheDocument();
  expect(screen.getByText(/registry coverage/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- src/features/overview/OverviewSummary.test.tsx`

Expected: FAIL with `Cannot find module './OverviewSummary'`.

- [ ] **Step 3: Implement the summary-first overview**

```tsx
// apps/web/src/features/overview/OverviewSummary.tsx
import { Link } from "react-router-dom";
import { PageHeader } from "../../app/PageHeader";
import { AlertList, MetricCard, TrafficChart } from "./OverviewCards";
import { TopologyGraph } from "../topology/TopologyGraph";
import { TraceDetail } from "../logs/TraceDetail";

export function OverviewSummary({ snapshot, graphElements, registryCount }: Props) {
  const latestTrace = snapshot.traces[0] ?? null;

  return (
    <section className="page-stack">
      <PageHeader
        title="System Summary"
        description="High-signal view of system health, active anomalies, and the next places to investigate."
      />

      <div className="metric-grid metric-grid-compact">
        <MetricCard label="Active Servers" value={`${snapshot.overview.activeServers}/${snapshot.overview.totalServers}`} />
        <MetricCard label="Requests / Min" value={String(snapshot.overview.requestsLastMinute)} />
        <MetricCard label="Avg Latency" value={`${snapshot.overview.averageLatencyMs}ms`} />
        <MetricCard label="Anomalies" value={String(snapshot.overview.anomalyCount)} />
      </div>

      <div className="overview-grid">
        <article className="panel panel-plain">
          <h2>Active Anomalies</h2>
          <AlertList alerts={snapshot.alerts.slice(0, 4)} />
        </article>

        <article className="panel panel-dark">
          <h2>Traffic</h2>
          <TrafficChart timeseries={snapshot.timeseries} />
        </article>

        <article className="panel panel-dark">
          <h2>Topology Preview</h2>
          <TopologyGraph topologyElements={graphElements.flat} />
        </article>

        <article className="panel panel-plain quick-links-panel">
          <h2>Go Deeper</h2>
          <Link to="/topology">Open Topology</Link>
          <Link to="/logs">Open Logs</Link>
          <Link to="/health">Open Health</Link>
        </article>

        <article className="panel panel-plain">
          <h2>Latest Trace</h2>
          {latestTrace ? <TraceDetail trace={latestTrace} /> : <p className="empty">No traces available.</p>}
        </article>

        <article className="panel panel-plain">
          <h2>Registry Coverage</h2>
          <p>{registryCount} MCP endpoints discovered.</p>
        </article>
      </div>
    </section>
  );
}
```

```tsx
// apps/web/src/pages/OverviewPage.tsx
import { OverviewSummary } from "../features/overview/OverviewSummary";

export function OverviewPage() {
  return (
    <>
      <LiveTrafficControls
        pending={actionPending}
        message={actionMessage}
        onRunAgentTask={() => void onRunAgentTask()}
        onRunSearch={() => void onRunSearch()}
        onRunFailure={() => void onRunFailure()}
        onRunBlaxelTask={() => void onRunBlaxelTask()}
      />
      <OverviewSummary
        snapshot={snapshot}
        graphElements={graphElements}
        registryCount={blaxelFunctions.length}
      />
    </>
  );
}
```

```css
/* apps/web/src/styles.css */
.panel-plain {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: #111111;
}

.panel-dark {
  background: #111827;
  border: 1px solid #1f2937;
  color: #f9fafb;
}

.quick-links-panel a {
  display: block;
  margin-top: 10px;
  color: #111111;
  font-weight: 600;
}
```

- [ ] **Step 4: Run the targeted overview tests**

Run: `npm run test -w @mcp-atlas/web -- src/features/overview/OverviewSummary.test.tsx src/app/App.test.tsx`

Expected: PASS with the executive-summary test and the app shell smoke test both green.

- [ ] **Step 5: Commit the overview slice**

```bash
git add apps/web/src/features/overview/OverviewSummary.tsx apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/pages/OverviewPage.tsx apps/web/src/features/controls/LiveTrafficControls.tsx apps/web/src/features/registry/McpRegistryPanel.tsx apps/web/src/features/overview/OverviewCards.tsx apps/web/src/styles.css
git commit -m "feat: add executive overview summary"
```

### Task 3: Restyle Logs And Health Around The Light Shell

**Files:**
- Create: `apps/web/src/features/logs/LogsWorkspace.tsx`
- Create: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
- Modify: `apps/web/src/pages/LogsPage.tsx`
- Modify: `apps/web/src/pages/HealthPage.tsx`
- Modify: `apps/web/src/features/logs/TraceList.tsx`
- Modify: `apps/web/src/features/logs/TraceDetail.tsx`
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing logs-workspace test**

```tsx
import { render, screen } from "@testing-library/react";
import { LogsWorkspace } from "./LogsWorkspace";

it("renders a two-pane logs workspace with a dark trace detail surface", () => {
  render(
    <LogsWorkspace
      traces={[trace]}
      selectedTrace={trace}
      selectedTraceId={trace.traceId}
      onSelectTrace={() => {}}
    />,
  );

  expect(screen.getByRole("heading", { name: /request logs/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /trace detail/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /export excel csv/i })).toBeInTheDocument();
  expect(document.querySelector(".trace-detail-surface")).not.toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- src/features/logs/LogsWorkspace.test.tsx`

Expected: FAIL with `Cannot find module './LogsWorkspace'`.

- [ ] **Step 3: Implement the logs workspace and health restyle**

```tsx
// apps/web/src/features/logs/LogsWorkspace.tsx
import { exportTraceCsv } from "./export-trace-csv";
import { TraceDetail } from "./TraceDetail";
import { TraceList } from "./TraceList";

export function LogsWorkspace({ traces, selectedTrace, selectedTraceId, onSelectTrace }: Props) {
  return (
    <section className="logs-workspace">
      <article className="panel panel-plain">
        <h2>Request Logs</h2>
        <TraceList traces={traces} selectedTraceId={selectedTraceId} onSelectTrace={onSelectTrace} />
      </article>

      <article className="panel panel-dark trace-detail-surface">
        <div className="panel-header">
          <div>
            <h2>Trace Detail</h2>
            <p>Hop-by-hop lifecycle of the selected request.</p>
          </div>
          {selectedTrace ? (
            <button type="button" className="action-button" onClick={() => exportTraceCsv(selectedTrace)}>
              Export Excel CSV
            </button>
          ) : null}
        </div>
        {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">Select a trace to inspect it.</p>}
      </article>
    </section>
  );
}
```

```tsx
// apps/web/src/pages/LogsPage.tsx
import { LogsWorkspace } from "../features/logs/LogsWorkspace";
import { PageHeader } from "../app/PageHeader";

export function LogsPage() {
  return (
    <section className="page-stack">
      <PageHeader title="Logs" description="Trace lists and request-by-request detail for recent MCP activity." />
      <LogsWorkspace
        traces={snapshot.traces}
        selectedTrace={selectedTrace}
        selectedTraceId={selectedTraceId}
        onSelectTrace={setSelectedTraceId}
      />
    </section>
  );
}
```

```tsx
// apps/web/src/pages/HealthPage.tsx
import { PageHeader } from "../app/PageHeader";

export function HealthPage() {
  return (
    <section className="page-stack">
      <PageHeader title="Health" description="Heartbeat, throughput, latency, and failure pressure across MCP servers." />
      <HealthGrid snapshot={snapshot} />
    </section>
  );
}
```

```css
/* apps/web/src/styles.css */
.logs-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 20px;
}

.trace-detail-surface .trace-banner,
.trace-detail-surface .hop-card {
  background: #0f172a;
  border-color: #334155;
}

.table-wrap table {
  background: #ffffff;
}
```

- [ ] **Step 4: Run the targeted logs and health tests**

Run: `npm run test -w @mcp-atlas/web -- src/features/logs/LogsWorkspace.test.tsx src/features/logs/export-trace-csv.test.ts src/app/App.test.tsx`

Expected: PASS with the new logs workspace test, CSV export test, and app smoke test all green.

- [ ] **Step 5: Commit the logs/health slice**

```bash
git add apps/web/src/features/logs/LogsWorkspace.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/pages/LogsPage.tsx apps/web/src/pages/HealthPage.tsx apps/web/src/features/logs/TraceList.tsx apps/web/src/features/logs/TraceDetail.tsx apps/web/src/features/health/HealthGrid.tsx apps/web/src/styles.css
git commit -m "feat: restyle logs and health workspaces"
```

### Task 4: Reframe The Topology Page Inside The New Light System

**Files:**
- Create: `apps/web/src/pages/TopologyPage.test.tsx`
- Modify: `apps/web/src/pages/TopologyPage.tsx`
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing topology-page test**

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { TopologyPage } from "./TopologyPage";

vi.mock("../app/App", () => ({
  useDashboardAppContext: () => ({
    snapshot: dashboardSnapshot,
    graphElements: { flat: [], clustered: [] },
  }),
}));

it("renders the topology page header, cluster action, and supporting white detail cards", () => {
  render(<TopologyPage />);

  expect(screen.getByRole("heading", { name: /topology/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /clusters/i })).toBeInTheDocument();
  expect(screen.getByText(/dependency edges/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- src/pages/TopologyPage.test.tsx`

Expected: FAIL because the current page does not render the new page header structure yet.

- [ ] **Step 3: Implement the lighter framing around the dark graph**

```tsx
// apps/web/src/pages/TopologyPage.tsx
import { PageHeader } from "../app/PageHeader";
import { AlertList } from "../features/overview/OverviewCards";

export function TopologyPage() {
  return (
    <section className="page-stack">
      <PageHeader
        title="Topology"
        description="Directed request paths, tool connectivity, and cluster groupings across the MCP graph."
        actions={
          <button
            type="button"
            className={`action-button ${showClusters ? "action-button-active" : ""}`}
            onClick={() => setShowClusters((current) => !current)}
          >
            Clusters
          </button>
        }
      />

      <div className="topology-layout">
        <article className="panel panel-dark panel-topology">
          <TopologyGraph topologyElements={showClusters ? graphElements.clustered : graphElements.flat} tall clustered={showClusters} />
        </article>

        <article className="panel panel-plain">
          <h2>Dependency Edges</h2>
          <div className="edge-list">
            {snapshot.dependencies.map((edge) => (
              <div key={`${edge.source}-${edge.target}`} className="edge-card">
                <strong>
                  {edge.source} -&gt; {edge.target}
                </strong>
                <div className="trace-meta">
                  <span>{edge.volume} req</span>
                  <span>{edge.averageLatencyMs}ms avg</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel panel-plain">
          <h2>Alignment Insights</h2>
          <AlertList alerts={snapshot.alerts} />
        </article>
      </div>
    </section>
  );
}
```

```css
/* apps/web/src/styles.css */
.topology-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 20px;
}

.panel-topology {
  min-height: 680px;
}

.graph-wrap {
  background: #0f172a;
  border-radius: 18px;
}
```

- [ ] **Step 4: Run the targeted topology tests**

Run: `npm run test -w @mcp-atlas/web -- src/pages/TopologyPage.test.tsx src/features/topology/build-topology-elements.test.ts`

Expected: PASS with the topology-page framing test and topology-element builder test both green.

- [ ] **Step 5: Commit the topology slice**

```bash
git add apps/web/src/pages/TopologyPage.test.tsx apps/web/src/pages/TopologyPage.tsx apps/web/src/features/topology/TopologyGraph.tsx apps/web/src/styles.css
git commit -m "feat: reframe topology for minimalist shell"
```

### Task 5: Final Responsive Polish And Full Verification

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/app/SidebarShell.test.tsx`

- [ ] **Step 1: Add the final regression checks for the shell**

```tsx
it("keeps the mobile navigation trigger and desktop sidebar landmarks available", () => {
  render(
    <MemoryRouter>
      <SidebarShell generatedAt={1712952000000} overview={overview}>
        <div>Overview body</div>
      </SidebarShell>
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shell regression tests**

Run: `npm run test -w @mcp-atlas/web -- src/app/SidebarShell.test.tsx src/app/App.test.tsx`

Expected: PASS with the navigation regression checks green.

- [ ] **Step 3: Apply the final responsive CSS cleanup**

```css
/* apps/web/src/styles.css */
@media (max-width: 1024px) {
  .shell-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .logs-workspace,
  .topology-layout,
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .shell-main {
    padding: 20px;
  }

  .metric-grid,
  .metric-grid-compact {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
npm run test -w @mcp-atlas/web
npm run build -w @mcp-atlas/web
npm run test
npm run build
```

Expected:

- web tests PASS
- web build exits 0
- full workspace tests PASS
- full workspace build exits 0

Manual browser smoke checklist:

- open `http://localhost:5173`
- confirm the shell background is white and the sidebar is visible
- confirm the primary buttons are black
- confirm `Overview` is summary-first rather than a full deep-dive dashboard
- confirm the topology graph still renders on a dark surface
- confirm the logs trace detail remains dark and readable
- confirm the mobile breakpoint collapses layouts cleanly

- [ ] **Step 5: Commit the final UI polish**

```bash
git add apps/web/src/styles.css apps/web/src/app/App.test.tsx apps/web/src/app/SidebarShell.test.tsx
git commit -m "feat: finalize minimalist UI refresh"
```
