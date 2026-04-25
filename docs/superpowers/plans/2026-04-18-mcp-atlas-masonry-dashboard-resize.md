# MCP Atlas Masonry Dashboard Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current thick resize-bar desktop layout with a thin-edge, masonry-packed resize system that freely resizes major dashboard cards and closes layout gaps immediately.

**Architecture:** Keep the existing page routes and card content components, but move desktop layout responsibility into a shared `MasonryWorkspace` plus a small packing utility. `ResizablePanel` remains the interaction primitive, but it stops acting like a self-sized grid item and instead reports size changes into the workspace so sibling cards can repack after each resize.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Cytoscape, Recharts, global CSS in `apps/web/src/styles.css`

---

## File Structure

- Create: `apps/web/src/components/masonry-layout.ts`
  - Pure packing utility and related desktop-layout constants.
- Create: `apps/web/src/components/masonry-layout.test.ts`
  - Unit tests for hole-filling, bounds, and stable DOM ordering assumptions.
- Create: `apps/web/src/components/MasonryWorkspace.tsx`
  - Shared desktop masonry container that measures width, computes packed positions, and renders cards.
- Create: `apps/web/src/components/MasonryWorkspace.test.tsx`
  - Component tests for desktop packing and non-desktop fallback behavior.
- Modify: `apps/web/src/components/ResizablePanel.tsx`
  - Thin handle rendering, size reporting, and compatibility with absolute-positioned masonry cards.
- Modify: `apps/web/src/components/ResizablePanel.test.tsx`
  - Tests for thin handles, resize callbacks, and existing drag behavior.
- Modify: `apps/web/src/features/overview/OverviewSummary.tsx`
  - Replace direct `dashboard-grid` usage with `MasonryWorkspace`.
- Modify: `apps/web/src/features/overview/OverviewSummary.test.tsx`
  - Verify overview cards render inside the masonry workspace.
- Modify: `apps/web/src/features/logs/LogsWorkspace.tsx`
  - Move request logs and trace detail into the masonry workspace.
- Modify: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
  - Verify logs workspace cards repack-capable rendering still preserves selection/export behavior.
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
  - Move health cards into the masonry workspace.
- Modify: `apps/web/src/features/health/HealthGrid.test.tsx`
  - Verify health cards render as masonry items.
- Modify: `apps/web/src/pages/TopologyPage.tsx`
  - Render topology graph and support panels through the masonry workspace and keep graph resize signaling.
- Modify: `apps/web/src/pages/TopologyPage.test.tsx`
  - Verify topology workspace cards render in masonry mode and cluster toggling still works.
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`
  - Keep Cytoscape reflowing after masonry resize completion.
- Modify: `apps/web/src/styles.css`
  - Add masonry container/card positioning styles and replace thick resize bars with thin edge affordances.
- Modify: `apps/web/src/app/App.test.tsx`
  - Regression assertion for masonry and thin-handle CSS rules.

### Task 1: Add the pure masonry packing utility

**Files:**
- Create: `apps/web/src/components/masonry-layout.ts`
- Create: `apps/web/src/components/masonry-layout.test.ts`

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it } from "vitest";
import { packMasonryItems } from "./masonry-layout";

describe("packMasonryItems", () => {
  it("moves later cards upward to close holes after a shrink", () => {
    const packed = packMasonryItems(
      [
        { id: "hero", width: 520, height: 240 },
        { id: "anomalies", width: 320, height: 220 },
        { id: "traffic", width: 320, height: 220 },
      ],
      { width: 960, gutter: 20 },
    );

    expect(packed.map((item) => ({ id: item.id, x: item.x, y: item.y }))).toEqual([
      { id: "hero", x: 0, y: 0 },
      { id: "anomalies", x: 540, y: 0 },
      { id: "traffic", x: 540, y: 240 },
    ]);
  });

  it("recomputes positions when the first card shrinks and fills the earliest available slot", () => {
    const packed = packMasonryItems(
      [
        { id: "hero", width: 360, height: 240 },
        { id: "anomalies", width: 320, height: 220 },
        { id: "traffic", width: 320, height: 220 },
      ],
      { width: 960, gutter: 20 },
    );

    expect(packed.map((item) => ({ id: item.id, x: item.x, y: item.y }))).toEqual([
      { id: "hero", x: 0, y: 0 },
      { id: "anomalies", x: 380, y: 0 },
      { id: "traffic", x: 0, y: 260 },
    ]);
  });

  it("returns the packed workspace height from the lowest occupied edge", () => {
    const packed = packMasonryItems(
      [
        { id: "a", width: 420, height: 240 },
        { id: "b", width: 420, height: 300 },
      ],
      { width: 920, gutter: 20 },
    );

    expect(packed.height).toBe(300);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/masonry-layout.test.ts`

Expected: FAIL with `Cannot find module './masonry-layout'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/web/src/components/masonry-layout.ts
export type MasonryItemSize = {
  id: string;
  width: number;
  height: number;
};

export type PackedMasonryItem = MasonryItemSize & {
  x: number;
  y: number;
};

type PackOptions = {
  width: number;
  gutter: number;
};

export function packMasonryItems(items: MasonryItemSize[], options: PackOptions) {
  const placed: PackedMasonryItem[] = [];

  for (const item of items) {
    let bestX = 0;
    let bestY = Number.POSITIVE_INFINITY;
    const step = 8;
    const maxX = Math.max(0, options.width - item.width);

    for (let x = 0; x <= maxX; x += step) {
      const y = findLowestAvailableY(placed, item, x, options.gutter);
      if (y < bestY || (y === bestY && x < bestX)) {
        bestX = x;
        bestY = y;
      }
    }

    placed.push({ ...item, x: bestX, y: bestY });
  }

  const height = placed.reduce((max, item) => Math.max(max, item.y + item.height), 0);
  return Object.assign(placed, { height });
}

function findLowestAvailableY(
  placed: PackedMasonryItem[],
  current: MasonryItemSize,
  nextX: number,
  gutter: number,
) {
  let nextY = 0;

  for (const item of placed) {
    const overlapsX =
      nextX < item.x + item.width + gutter && nextX + current.width + gutter > item.x;

    if (overlapsX) {
      nextY = Math.max(nextY, item.y + item.height + gutter);
    }
  }

  return nextY;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/masonry-layout.test.ts`

Expected: PASS with `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/masonry-layout.ts apps/web/src/components/masonry-layout.test.ts
git commit -m "feat: add masonry layout packer"
```

### Task 2: Add the shared masonry workspace and thin resize handles

**Files:**
- Create: `apps/web/src/components/MasonryWorkspace.tsx`
- Create: `apps/web/src/components/MasonryWorkspace.test.tsx`
- Modify: `apps/web/src/components/ResizablePanel.tsx`
- Modify: `apps/web/src/components/ResizablePanel.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MasonryWorkspace } from "./MasonryWorkspace";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(min-width: 1024px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("MasonryWorkspace", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("positions cards absolutely on desktop and exposes workspace height", () => {
    render(
      <MasonryWorkspace
        workspaceId="overview"
        items={[
          {
            id: "hero",
            label: "hero",
            defaultSize: { width: 520, height: 240 },
            minSize: { width: 360, height: 220 },
            maxSize: { width: 1200, height: 520 },
            content: <div>Hero</div>,
          },
          {
            id: "anomalies",
            label: "anomalies",
            defaultSize: { width: 320, height: 220 },
            minSize: { width: 280, height: 200 },
            maxSize: { width: 900, height: 420 },
            content: <div>Anomalies</div>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("masonry-workspace-overview")).toBeInTheDocument();
    expect(screen.getByTestId("masonry-card-overview-hero")).toHaveStyle({ position: "absolute" });
  });
});
```

```tsx
it("renders thin resize handles rather than thick bars", () => {
  renderPanel();

  expect(screen.getByLabelText("Resize summary panel width")).toHaveClass("resize-handle-east");
  expect(screen.getByLabelText("Resize summary panel height")).toHaveClass("resize-handle-south");
  expect(screen.getByLabelText("Resize summary panel width and height")).toHaveClass("resize-handle-corner");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/MasonryWorkspace.test.tsx apps/web/src/components/ResizablePanel.test.tsx`

Expected: FAIL with missing `MasonryWorkspace` module and missing workspace/card test ids.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// apps/web/src/components/MasonryWorkspace.tsx
import { useMemo, useRef, useState } from "react";
import { ResizablePanel } from "./ResizablePanel";
import { packMasonryItems } from "./masonry-layout";
import { useDesktopResize } from "./useDesktopResize";

type Size = { width: number; height: number };

type MasonryCard = {
  id: string;
  label: string;
  className?: string;
  defaultSize: Size;
  minSize: Size;
  maxSize: Size;
  onResizeEnd?: (size: Size) => void;
  content: React.ReactNode;
};

export function MasonryWorkspace({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: MasonryCard[];
}) {
  const isDesktop = useDesktopResize();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sizes, setSizes] = useState<Record<string, Size>>(
    Object.fromEntries(items.map((item) => [item.id, item.defaultSize])),
  );

  const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 1200;
  const packed = useMemo(
    () =>
      packMasonryItems(
        items.map((item) => ({ id: item.id, ...sizes[item.id] })),
        { width: containerWidth, gutter: 20 },
      ),
    [containerWidth, items, sizes],
  );

  if (!isDesktop) {
    return (
      <div className="dashboard-grid">
        {items.map((item) => (
          <ResizablePanel
            key={item.id}
            panelId={item.id}
            label={item.label}
            className={item.className}
            defaultSize={item.defaultSize}
            minSize={item.minSize}
            maxSize={item.maxSize}
            onResizeEnd={item.onResizeEnd}
          >
            {item.content}
          </ResizablePanel>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid={`masonry-workspace-${workspaceId}`}
      className="masonry-workspace"
      style={{ height: `${packed.height}px` }}
    >
      {items.map((item) => {
        const layout = packed.find((entry) => entry.id === item.id)!;

        return (
          <div
            key={item.id}
            data-testid={`masonry-card-${workspaceId}-${item.id}`}
            className="masonry-card"
            style={{ position: "absolute", left: `${layout.x}px`, top: `${layout.y}px` }}
          >
            <ResizablePanel
              panelId={item.id}
              label={item.label}
              className={item.className}
              defaultSize={sizes[item.id]}
              minSize={item.minSize}
              maxSize={item.maxSize}
              onResizeEnd={(size) => {
                setSizes((current) => ({ ...current, [item.id]: size }));
                item.onResizeEnd?.(size);
              }}
            >
              {item.content}
            </ResizablePanel>
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// apps/web/src/components/ResizablePanel.tsx
<button
  type="button"
  className="resize-handle resize-handle-east"
  aria-label={`Resize ${label} width`}
  onMouseDown={startResize("width")}
/>
```

```css
/* apps/web/src/styles.css */
.masonry-workspace {
  position: relative;
  width: 100%;
}

.masonry-card {
  transition: left 180ms ease, top 180ms ease;
}

.resize-handle-east {
  top: 10px;
  right: -1px;
  width: 4px;
  height: calc(100% - 20px);
}

.resize-handle-south {
  left: 10px;
  bottom: -1px;
  width: calc(100% - 20px);
  height: 4px;
}

.resize-handle-corner {
  right: 6px;
  bottom: 6px;
  width: 10px;
  height: 10px;
}

.resize-handle::after {
  background: rgba(15, 23, 42, 0.18);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/MasonryWorkspace.test.tsx apps/web/src/components/ResizablePanel.test.tsx`

Expected: PASS with workspace/card positioning and thin-handle assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MasonryWorkspace.tsx apps/web/src/components/MasonryWorkspace.test.tsx apps/web/src/components/ResizablePanel.tsx apps/web/src/components/ResizablePanel.test.tsx apps/web/src/styles.css
git commit -m "feat: add masonry workspace and thin resize handles"
```

### Task 3: Move Overview, Logs, Health, and Topology to the masonry workspace

**Files:**
- Modify: `apps/web/src/features/overview/OverviewSummary.tsx`
- Modify: `apps/web/src/features/overview/OverviewSummary.test.tsx`
- Modify: `apps/web/src/features/logs/LogsWorkspace.tsx`
- Modify: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
- Modify: `apps/web/src/features/health/HealthGrid.test.tsx`
- Modify: `apps/web/src/pages/TopologyPage.tsx`
- Modify: `apps/web/src/pages/TopologyPage.test.tsx`
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/features/overview/OverviewSummary.test.tsx
expect(screen.getByTestId("masonry-workspace-overview")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-overview-overview-hero")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-overview-overview-anomalies")).toBeInTheDocument();
```

```tsx
// apps/web/src/features/logs/LogsWorkspace.test.tsx
expect(screen.getByTestId("masonry-workspace-logs")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-logs-logs-list")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-logs-logs-detail")).toBeInTheDocument();
```

```tsx
// apps/web/src/features/health/HealthGrid.test.tsx
expect(screen.getByTestId("masonry-workspace-health")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-health-health-table")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-health-health-latency")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-health-health-failures")).toBeInTheDocument();
```

```tsx
// apps/web/src/pages/TopologyPage.test.tsx
fireEvent.click(screen.getByRole("button", { name: /clusters/i }));

expect(screen.getByTestId("masonry-workspace-topology")).toBeInTheDocument();
expect(screen.getByTestId("masonry-card-topology-topology-graph")).toBeInTheDocument();
expect(mockTopologyGraph).toHaveBeenLastCalledWith(
  expect.objectContaining({
    clustered: true,
    resizeSignal: expect.any(Number),
  }),
);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.test.tsx apps/web/src/pages/TopologyPage.test.tsx`

Expected: FAIL with missing masonry workspace/card test ids.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// apps/web/src/features/overview/OverviewSummary.tsx
import { MasonryWorkspace } from "../../components/MasonryWorkspace";

const heroContent = (
  <>
    <div className="panel-header panel-header-stack">
      <div>
        <p className="eyebrow">Executive Summary</p>
        <h2>Executive Summary</h2>
        <p>Focus on coverage, anomalies, and the latest trace moving through the Atlas control plane.</p>
      </div>
    </div>
    <div className="summary-metric-grid">
      <MetricCard label="Active Servers" value={`${snapshot.overview.activeServers}/${snapshot.overview.totalServers}`} detail={formatCount(snapshot.servers.filter((server) => server.status === "degraded").length, "degraded node")} />
      <MetricCard label="Requests / Min" value={String(snapshot.overview.requestsLastMinute)} detail={latestTraffic ? `Current window ${latestTraffic.requests}` : "No recent traffic"} />
      <MetricCard label="Avg Latency" value={`${snapshot.overview.averageLatencyMs}ms`} detail={peakRequests ? `Peak throughput ${peakRequests}/min` : "No throughput sample"} />
      <MetricCard label="Failed Requests" value={String(snapshot.overview.failedRequests)} detail={`${snapshot.overview.anomalyCount} active anomalies`} />
    </div>
  </>
);

const anomalyContent = (
  <>
    <div className="panel-header">
      <div>
        <h2>Active Anomalies</h2>
        <p>Top live issues that need operator attention.</p>
      </div>
      <span className={`status-pill ${snapshot.alerts.length > 0 ? "status-failed" : "status-online"}`}>
        {snapshot.alerts.length > 0 ? `${snapshot.alerts.length} active` : "clear"}
      </span>
    </div>
    <div className="summary-anomaly-list">
      {snapshot.alerts.length === 0 ? (
        <p className="empty summary-empty">No anomalies detected in the recent telemetry window.</p>
      ) : (
        snapshot.alerts.slice(0, 3).map((alert) => (
          <article key={alert.id} className={`summary-anomaly-card severity-${alert.severity}`}>
            <strong>{alert.title}</strong>
            <p>{alert.detail}</p>
          </article>
        ))
      )}
    </div>
  </>
);

const quickLinksContent = (
  <>
    <div className="panel-header panel-header-stack">
      <div>
        <h2>Quick Links</h2>
        <p>Jump directly into the deeper operational views.</p>
      </div>
    </div>
    <nav aria-label="Quick Links" className="summary-quick-links">
      <Link to="/topology" className="summary-link-card">
        <strong>Topology</strong>
        <span>Inspect node relationships and routing.</span>
      </Link>
      <Link to="/logs" className="summary-link-card">
        <strong>Logs</strong>
        <span>Review traces, request paths, and failures.</span>
      </Link>
      <Link to="/health" className="summary-link-card">
        <strong>Health</strong>
        <span>Check latency, uptime, and saturation signals.</span>
      </Link>
    </nav>
  </>
);

const trafficContent = (
  <>
    <div className="panel-header">
      <div>
        <h2>Traffic Pulse</h2>
        <p>Compact live request and failure view for the last minute.</p>
      </div>
      <div className="summary-stat-stack">
        <strong>{latestTraffic ? `${latestTraffic.failures} failures` : "No failures"}</strong>
        <span>{latestTraffic ? `${latestTraffic.averageLatencyMs}ms avg` : "No latency sample"}</span>
      </div>
    </div>
    <TrafficChart timeseries={snapshot.timeseries} compact />
  </>
);

const topologyContent = (
  <>
    <div className="panel-header panel-header-stack">
      <div>
        <h2>Topology Preview</h2>
        <p>Compact network map showing current traffic flow.</p>
      </div>
      <span className="summary-topology-meta">{formatCount(snapshot.dependencies.length, "active route")}</span>
    </div>
    <TopologyGraph topologyElements={graphElements.flat} />
  </>
);

const traceContent = latestTrace ? (
  <>
    <div className="panel-header">
      <div>
        <h2>Latest Trace</h2>
        <p>Most recent request flow and its last known outcome.</p>
      </div>
      <span className={`status-pill status-${latestTrace.status}`}>{latestTrace.status}</span>
    </div>
    <div className="summary-trace-stack">
      <div className="summary-trace-meta">
        <div>
          <strong>{latestTrace.requestId}</strong>
          <p>{latestTrace.path.join(" -> ")}</p>
        </div>
        <div>
          <strong>{latestTrace.totalLatencyMs}ms</strong>
          <p>{formatCount(latestTrace.hops.length, "hop")}</p>
        </div>
      </div>
      <TraceDetail trace={latestTrace} />
    </div>
  </>
) : (
  <p className="empty summary-empty">No traces available.</p>
);

const registryContent = (
  <>
    <div className="panel-header panel-header-stack">
      <div>
        <h2>Registry Coverage</h2>
        <p>{`${blaxelFunctions.length} Blaxel functions discovered, ${enabledFunctions} currently enabled.`}</p>
      </div>
      <span className="summary-topology-meta">{formatCount(loadedToolCount, "loaded tool")}</span>
    </div>
    <McpRegistryPanel
      blaxelFunctions={blaxelFunctions}
      functionTestState={functionTestState}
      functionTools={functionTools}
      functionToolState={functionToolState}
      onTestFunction={onTestFunction}
      onLoadTools={onLoadTools}
    />
  </>
);

return (
  <MasonryWorkspace
    workspaceId="overview"
    items={[
      {
        id: "overview-hero",
        label: "executive summary",
        className: "panel summary-hero",
        defaultSize: { width: 1160, height: 300 },
        minSize: { width: 520, height: 220 },
        maxSize: { width: 1800, height: 520 },
        content: heroContent,
      },
      {
        id: "overview-anomalies",
        label: "active anomalies",
        className: "panel summary-panel-light",
        defaultSize: { width: 700, height: 320 },
        minSize: { width: 380, height: 220 },
        maxSize: { width: 1400, height: 520 },
        content: anomalyContent,
      },
      {
        id: "overview-quick-links",
        label: "quick links",
        className: "panel summary-panel-light summary-links-panel",
        defaultSize: { width: 420, height: 320 },
        minSize: { width: 320, height: 220 },
        maxSize: { width: 1200, height: 520 },
        content: quickLinksContent,
      },
      {
        id: "overview-traffic",
        label: "traffic pulse",
        className: "panel summary-panel-dark",
        defaultSize: { width: 760, height: 360 },
        minSize: { width: 420, height: 260 },
        maxSize: { width: 1600, height: 620 },
        content: trafficContent,
      },
      {
        id: "overview-topology",
        label: "topology preview",
        className: "panel summary-panel-dark",
        defaultSize: { width: 420, height: 360 },
        minSize: { width: 340, height: 260 },
        maxSize: { width: 1200, height: 620 },
        content: topologyContent,
      },
      {
        id: "overview-trace",
        label: "latest trace",
        className: "panel summary-panel-light",
        defaultSize: { width: 760, height: 520 },
        minSize: { width: 420, height: 360 },
        maxSize: { width: 1600, height: 960 },
        content: traceContent,
      },
      {
        id: "overview-registry",
        label: "registry coverage",
        className: "panel summary-panel-light",
        defaultSize: { width: 420, height: 520 },
        minSize: { width: 340, height: 360 },
        maxSize: { width: 1200, height: 960 },
        content: registryContent,
      },
    ]}
  />
);
```

```tsx
// apps/web/src/features/logs/LogsWorkspace.tsx
import { MasonryWorkspace } from "../../components/MasonryWorkspace";

return (
  <MasonryWorkspace
    workspaceId="logs"
    items={[
      {
        id: "logs-list",
        label: "request logs",
        className: "panel logs-workspace-list",
        defaultSize: { width: 520, height: 640 },
        minSize: { width: 360, height: 420 },
        maxSize: { width: 1200, height: 1200 },
        content: (
          <>
            <div className="panel-header panel-header-stack">
              <div>
                <h2>Request Logs</h2>
                <p>Recent traces reconstructed from MCP telemetry events.</p>
              </div>
            </div>
            <TraceList traces={traces} selectedTraceId={selectedTraceId} onSelectTrace={onSelectTrace} />
          </>
        ),
      },
      {
        id: "logs-detail",
        label: "trace detail",
        className: "panel logs-workspace-detail logs-workspace-detail-dark",
        defaultSize: { width: 720, height: 720 },
        minSize: { width: 420, height: 420 },
        maxSize: { width: 1400, height: 1200 },
        content: (
          <>
            <div className="panel-header">
              <div>
                <h2>Trace Detail</h2>
                <p>Hop-by-hop lifecycle of the selected request.</p>
              </div>
              {selectedTrace ? (
                <div className="logs-workspace-export">
                  <button type="button" className="action-button export-button" onClick={() => exportTraceCsv(selectedTrace)}>
                    Export Excel CSV
                  </button>
                </div>
              ) : null}
            </div>
            {selectedTrace ? <TraceDetail trace={selectedTrace} /> : <p className="empty">Select a trace to inspect it.</p>}
          </>
        ),
      },
    ]}
  />
);
```

```tsx
// apps/web/src/features/health/HealthGrid.tsx
import { MasonryWorkspace } from "../../components/MasonryWorkspace";

return (
  <MasonryWorkspace
    workspaceId="health"
    items={[
      {
        id: "health-table",
        label: "server health",
        className: "panel health-table-panel",
        defaultSize: { width: 980, height: 420 },
        minSize: { width: 520, height: 360 },
        maxSize: { width: 1600, height: 1200 },
        content: (
          <>
            <div className="panel-header">
              <div>
                <h2>Server Health</h2>
                <p>Heartbeat, throughput, latency, and failure rate per MCP server.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>Status</th>
                    <th>Heartbeat</th>
                    <th>Req/Min</th>
                    <th>Avg Latency</th>
                    <th>P95</th>
                    <th>Failure Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.servers.map((server) => (
                    <tr key={server.name}>
                      <td>{server.name}</td>
                      <td><span className={`status-pill status-${server.status}`}>{server.status}</span></td>
                      <td>{server.heartbeatAt ? relativeTime(server.heartbeatAt) : "none"}</td>
                      <td>{server.requestsPerMinute}</td>
                      <td>{server.averageLatencyMs}ms</td>
                      <td>{server.p95LatencyMs}ms</td>
                      <td>{Math.round(server.errorRate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ),
      },
      {
        id: "health-latency",
        label: "latency",
        className: "panel health-chart-panel",
        defaultSize: { width: 420, height: 360 },
        minSize: { width: 320, height: 320 },
        maxSize: { width: 1200, height: 960 },
        content: (
          <>
            <div className="panel-header">
              <div>
                <h2>Latency</h2>
                <p>Average latency trend over the last minute.</p>
              </div>
            </div>
            <LatencyChart timeseries={snapshot.timeseries} />
          </>
        ),
      },
      {
        id: "health-failures",
        label: "failures",
        className: "panel health-alerts-panel",
        defaultSize: { width: 420, height: 360 },
        minSize: { width: 320, height: 320 },
        maxSize: { width: 1200, height: 960 },
        content: (
          <>
            <div className="panel-header">
              <div>
                <h2>Failures</h2>
                <p>Servers with the highest recent failure pressure.</p>
              </div>
            </div>
            <div className="alerts">
              {snapshot.servers
                .slice()
                .sort((a, b) => b.errorRate - a.errorRate)
                .map((server) => (
                  <div key={server.name} className="alert-card">
                    <div className="alert-title-row">
                      <strong>{server.name}</strong>
                      <span>{Math.round(server.errorRate * 100)}%</span>
                    </div>
                    <p>{server.requestsPerMinute} requests/min, p95 {server.p95LatencyMs}ms.</p>
                  </div>
                ))}
            </div>
          </>
        ),
      },
    ]}
  />
);
```

```tsx
// apps/web/src/pages/TopologyPage.tsx
import { MasonryWorkspace } from "../components/MasonryWorkspace";

return (
  <>
    <PageHeader
      eyebrow="Dependency map"
      title="Topology workspace"
      description="Read the live MCP network from a lighter shell, with the graph on a dark analysis surface and the supporting edge and anomaly context kept close."
      actions={
        <button
          type="button"
          className={`view-toggle ${showClusters ? "view-toggle-active" : ""}`}
          onClick={() => setShowClusters((current) => !current)}
        >
          Clusters
        </button>
      }
    />
    <MasonryWorkspace
      workspaceId="topology"
      items={[
        {
          id: "topology-graph",
          label: "topology graph panel",
          className: "panel summary-panel-dark topology-graph-panel",
          defaultSize: { width: 980, height: 760 },
          minSize: { width: 620, height: 460 },
          maxSize: { width: 1800, height: 1200 },
          onResizeEnd: () => setGraphResizeSignal((value) => value + 1),
          content: (
            <>
              <div className="panel-header">
                <div>
                  <h2>Network graph</h2>
                  <p>Directed edges stay readable, cluster mode groups servers by role, and tool leaf nodes show exposed capabilities.</p>
                </div>
                <span className="summary-topology-meta topology-panel-meta">
                  {snapshot.dependencies.length} live {snapshot.dependencies.length === 1 ? "edge" : "edges"}
                </span>
              </div>
              <div className="topology-graph-surface">
                <TopologyGraph
                  topologyElements={showClusters ? graphElements.clustered : graphElements.flat}
                  tall
                  clustered={showClusters}
                  resizeSignal={graphResizeSignal}
                  className="topology-graph-frame"
                />
              </div>
            </>
          ),
        },
        {
          id: "topology-edges",
          label: "dependency edges",
          className: "panel topology-support-panel",
          defaultSize: { width: 360, height: 340 },
          minSize: { width: 320, height: 260 },
          maxSize: { width: 1200, height: 900 },
          content: (
            <>
              <div className="panel-header">
                <div>
                  <h2>Dependency Edges</h2>
                  <p>Most active connections in the last minute.</p>
                </div>
              </div>
              <div className="edge-list">
                {snapshot.dependencies.map((edge) => (
                  <div key={`${edge.source}-${edge.target}`} className="edge-card">
                    <strong>{edge.source} -&gt; {edge.target}</strong>
                    <div className="trace-meta">
                      <span>{edge.volume} req</span>
                      <span>{edge.averageLatencyMs}ms avg</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ),
        },
        {
          id: "topology-insights",
          label: "alignment insights",
          className: "panel topology-support-panel",
          defaultSize: { width: 360, height: 340 },
          minSize: { width: 320, height: 260 },
          maxSize: { width: 1200, height: 900 },
          content: (
            <>
              <div className="panel-header">
                <div>
                  <h2>Alignment Insights</h2>
                  <p>Network-level anomalies surfaced from dependency and trace patterns.</p>
                </div>
              </div>
              <AlertList alerts={snapshot.alerts} />
            </>
          ),
        },
      ]}
    />
  </>
);
```

```tsx
// apps/web/src/features/topology/TopologyGraph.tsx
useEffect(() => {
  if (!cyRef.current) return;
  cyRef.current.resize();
  cyRef.current.fit(cyRef.current.elements(), clustered ? 54 : 30);
}, [resizeSignal, clustered, topologyElements]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.test.tsx apps/web/src/pages/TopologyPage.test.tsx`

Expected: PASS with masonry workspace rendering on all four pages.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/overview/OverviewSummary.tsx apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.tsx apps/web/src/features/health/HealthGrid.test.tsx apps/web/src/pages/TopologyPage.tsx apps/web/src/pages/TopologyPage.test.tsx apps/web/src/features/topology/TopologyGraph.tsx
git commit -m "feat: move dashboard pages to masonry workspace"
```

### Task 4: Finalize masonry styling and run the full regression suite

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/components/MasonryWorkspace.tsx`
- Modify: `apps/web/src/components/ResizablePanel.tsx`

- [ ] **Step 1: Write the failing regression assertions**

```tsx
// apps/web/src/app/App.test.tsx
import { readFileSync } from "node:fs";

it("contains masonry workspace styles and thin resize affordances", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  expect(css).toContain(".masonry-workspace");
  expect(css).toContain(".masonry-card");
  expect(css).toContain(".resize-handle-east");
  expect(css).toContain("width: 4px");
  expect(css).toContain("height: 4px");
});
```

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/app/App.test.tsx`

Expected: FAIL until the new masonry CSS and thin-handle rules are finalized.

- [ ] **Step 3: Write the minimal implementation**

```css
/* apps/web/src/styles.css */
.masonry-workspace {
  position: relative;
  width: 100%;
  min-height: 0;
}

.masonry-card {
  position: absolute;
  min-width: 0;
  transition:
    left 180ms ease,
    top 180ms ease,
    width 140ms ease,
    height 140ms ease;
}

.masonry-card > .resizable-panel {
  width: 100%;
  height: 100%;
}

.resize-handle {
  opacity: 0;
}

.resizable-panel:hover .resize-handle,
.resizable-panel-dragging .resize-handle {
  opacity: 1;
}

.resize-handle-east::after,
.resize-handle-south::after {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.18);
}

.resize-handle-corner::after {
  width: 10px;
  height: 10px;
  border-right: 1.5px solid rgba(15, 23, 42, 0.5);
  border-bottom: 1.5px solid rgba(15, 23, 42, 0.5);
  background: transparent;
}

@media (max-width: 1023px) {
  .masonry-workspace,
  .masonry-card {
    position: static;
    height: auto !important;
  }
}
```

```tsx
// apps/web/src/components/MasonryWorkspace.tsx
<div
  ref={containerRef}
  data-testid={`masonry-workspace-${workspaceId}`}
  className="masonry-workspace"
  style={isDesktop ? { height: `${packed.height}px` } : undefined}
>
```

- [ ] **Step 4: Run the focused and full verification**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/app/App.test.tsx`

Expected: PASS

Run: `npm run test`

Expected: PASS across contracts, api, and web

Run: `npm run build`

Expected: PASS across the workspace with only the existing Vite chunk-size warning at most

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/app/App.test.tsx apps/web/src/components/MasonryWorkspace.tsx apps/web/src/components/ResizablePanel.tsx
git commit -m "feat: finalize masonry dashboard resizing"
```
