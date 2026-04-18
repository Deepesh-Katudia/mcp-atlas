# MCP Atlas Resizable Dashboard Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lighter charcoal analysis surfaces, hover elevation, and desktop-only drag resizing for major dashboard panels across Overview, Topology, Logs, and Health.

**Architecture:** Keep the existing route/page structure and introduce one shared frontend resize primitive instead of a dashboard-grid library. Pages remain responsible for choosing which panels are resizable and for setting panel bounds, while graph and chart surfaces react to container-size changes inside their existing feature components.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Cytoscape, Recharts, global CSS in `apps/web/src/styles.css`

---

## File Structure

- Create: `apps/web/src/components/ResizablePanel.tsx`
  - Shared desktop-only resize wrapper that owns pointer events, temporary dimensions, and resize handles.
- Create: `apps/web/src/components/useDesktopResize.ts`
  - Small hook for desktop breakpoint detection and shared resize constraints.
- Create: `apps/web/src/components/ResizablePanel.test.tsx`
  - Tests for handle visibility and drag-to-resize behavior.
- Create: `apps/web/src/features/health/HealthGrid.test.tsx`
  - Focused test for health-panel resize wrappers.
- Modify: `apps/web/src/features/overview/OverviewSummary.tsx`
  - Wrap major overview panels in the shared resize primitive.
- Modify: `apps/web/src/features/overview/OverviewSummary.test.tsx`
  - Verify major overview sections are wrapped as resizable panels and still render expected content.
- Modify: `apps/web/src/features/logs/LogsWorkspace.tsx`
  - Wrap logs list/detail panels in the shared resize primitive.
- Modify: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
  - Verify resize wrappers coexist with trace selection/export.
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
  - Wrap health table/chart/failures panels in the shared resize primitive.
- Modify: `apps/web/src/pages/TopologyPage.tsx`
  - Wrap graph and support panels in the shared resize primitive and pass a resize signal to the graph.
- Modify: `apps/web/src/pages/TopologyPage.test.tsx`
  - Verify topology panels are resizable and cluster toggle behavior still works.
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`
  - Add resize observation or signal-based reflow so Cytoscape redraws after panel resize.
- Modify: `apps/web/src/styles.css`
  - Lighten dark analysis surfaces, add hover-elevation rules, and style resize handles and drag states.
- Modify: `apps/web/src/app/App.test.tsx`
  - Add coverage for the new shell-level interaction classes if needed.

### Task 1: Add the shared desktop resize primitive

**Files:**
- Create: `apps/web/src/components/ResizablePanel.tsx`
- Create: `apps/web/src/components/useDesktopResize.ts`
- Create: `apps/web/src/components/ResizablePanel.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing tests**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResizablePanel } from "./ResizablePanel";

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

describe("ResizablePanel", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("renders resize handles only on desktop", () => {
    render(
      <ResizablePanel
        panelId="summary"
        label="summary panel"
        defaultSize={{ width: 520, height: 320 }}
        minSize={{ width: 360, height: 240 }}
        maxSize={{ width: 980, height: 640 }}
      >
        <div>Summary body</div>
      </ResizablePanel>,
    );

    expect(screen.getByTestId("resizable-panel-summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel height")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width and height")).toBeInTheDocument();
  });

  it("updates width and height while dragging the corner handle", () => {
    render(
      <ResizablePanel
        panelId="summary"
        label="summary panel"
        defaultSize={{ width: 520, height: 320 }}
        minSize={{ width: 360, height: 240 }}
        maxSize={{ width: 980, height: 640 }}
      >
        <div>Summary body</div>
      </ResizablePanel>,
    );

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width and height");

    fireEvent.pointerDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.pointerMove(window, { clientX: 620, clientY: 410 });
    fireEvent.pointerUp(window);

    expect(panel).toHaveStyle({ width: "620px", height: "410px" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/ResizablePanel.test.tsx`

Expected: FAIL with `Cannot find module './ResizablePanel'` or missing resize-handle assertions.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// apps/web/src/components/useDesktopResize.ts
import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

export function useDesktopResize() {
  const getMatches = () => window.matchMedia(DESKTOP_QUERY).matches;
  const [isDesktop, setIsDesktop] = useState(getMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
```

```tsx
// apps/web/src/components/ResizablePanel.tsx
import { useMemo, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useDesktopResize } from "./useDesktopResize";

type Size = { width: number; height: number };
type ResizeMode = "width" | "height" | "both";

export function ResizablePanel({
  panelId,
  label,
  defaultSize,
  minSize,
  maxSize,
  onResizeEnd,
  className = "",
  children,
}: {
  panelId: string;
  label: string;
  defaultSize: Size;
  minSize: Size;
  maxSize: Size;
  onResizeEnd?: (size: Size) => void;
  className?: string;
  children: ReactNode;
}) {
  const isDesktop = useDesktopResize();
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState<ResizeMode | null>(null);

  const panelStyle = useMemo(
    () => ({
      width: `${size.width}px`,
      height: `${size.height}px`,
    }),
    [size],
  );

  const startResize =
    (mode: ResizeMode) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isDesktop) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = size.width;
      const startHeight = size.height;

      setDragging(mode);

      const onMove = (moveEvent: PointerEvent) => {
        setSize({
          width:
            mode === "height"
              ? startWidth
              : Math.min(maxSize.width, Math.max(minSize.width, startWidth + moveEvent.clientX - startX)),
          height:
            mode === "width"
              ? startHeight
              : Math.min(maxSize.height, Math.max(minSize.height, startHeight + moveEvent.clientY - startY)),
        });
      };

      const onUp = () => {
        setDragging(null);
        onResizeEnd?.(size);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  return (
    <div
      data-testid={`resizable-panel-${panelId}`}
      className={`resizable-panel ${dragging ? "resizable-panel-dragging" : ""} ${className}`.trim()}
      style={isDesktop ? panelStyle : undefined}
    >
      {children}
      {isDesktop ? (
        <>
          <button type="button" className="resize-handle resize-handle-east" aria-label={`Resize ${label} width`} onPointerDown={startResize("width")} />
          <button type="button" className="resize-handle resize-handle-south" aria-label={`Resize ${label} height`} onPointerDown={startResize("height")} />
          <button type="button" className="resize-handle resize-handle-corner" aria-label={`Resize ${label} width and height`} onPointerDown={startResize("both")} />
        </>
      ) : null}
    </div>
  );
}
```

```css
/* apps/web/src/styles.css */
.resizable-panel {
  position: relative;
  min-width: 0;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.resizable-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
}

.resize-handle {
  position: absolute;
  border: 0;
  background: transparent;
}

.resize-handle-east {
  top: 18px;
  right: -6px;
  width: 12px;
  height: calc(100% - 36px);
  cursor: ew-resize;
}

.resize-handle-south {
  left: 18px;
  bottom: -6px;
  width: calc(100% - 36px);
  height: 12px;
  cursor: ns-resize;
}

.resize-handle-corner {
  right: -6px;
  bottom: -6px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/components/ResizablePanel.test.tsx`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ResizablePanel.tsx apps/web/src/components/useDesktopResize.ts apps/web/src/components/ResizablePanel.test.tsx apps/web/src/styles.css
git commit -m "feat: add desktop resizable panel primitive"
```

### Task 2: Wire the resize primitive into Overview, Logs, and Health

**Files:**
- Modify: `apps/web/src/features/overview/OverviewSummary.tsx`
- Modify: `apps/web/src/features/overview/OverviewSummary.test.tsx`
- Modify: `apps/web/src/features/logs/LogsWorkspace.tsx`
- Modify: `apps/web/src/features/logs/LogsWorkspace.test.tsx`
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
- Create: `apps/web/src/features/health/HealthGrid.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/features/overview/OverviewSummary.test.tsx
import { MemoryRouter } from "react-router-dom";
import { buildTopologyElements } from "../topology/build-topology-elements";

it("wraps the executive summary, anomalies, traffic, topology, latest trace, and registry panels in resizable shells", () => {
  render(
    <MemoryRouter>
      <OverviewSummary
        snapshot={snapshot}
        graphElements={buildTopologyElements(snapshot)}
        blaxelFunctions={blaxelFunctions}
        functionTestState={{}}
        functionTools={{}}
        functionToolState={{}}
        onTestFunction={() => {}}
        onLoadTools={() => {}}
      />
    </MemoryRouter>,
  );

  expect(screen.getByTestId("resizable-panel-overview-summary-hero")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-overview-anomalies")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-overview-traffic")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-overview-topology")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-overview-trace")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-overview-registry")).toBeInTheDocument();
});
```

```tsx
// apps/web/src/features/logs/LogsWorkspace.test.tsx
expect(screen.getByTestId("resizable-panel-logs-list")).toBeInTheDocument();
expect(screen.getByTestId("resizable-panel-logs-detail")).toBeInTheDocument();
```

```tsx
// apps/web/src/features/health/HealthGrid.test.tsx
import type { DashboardSnapshot } from "@mcp-atlas/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthGrid } from "./HealthGrid";

const snapshot: DashboardSnapshot = {
  generatedAt: 1713200400000,
  overview: {
    totalServers: 1,
    activeServers: 1,
    requestsLastMinute: 18,
    averageLatencyMs: 64,
    failedRequests: 1,
    anomalyCount: 0,
  },
  servers: [
    {
      name: "Gateway MCP",
      status: "online",
      heartbeatAt: 1713200400000,
      requestsPerMinute: 18,
      averageLatencyMs: 64,
      p95LatencyMs: 92,
      errorRate: 0.01,
      throughput: 4,
      inFlight: 1,
    },
  ],
  toolsets: [],
  traces: [],
  dependencies: [],
  alerts: [],
  timeseries: [
    { timestamp: 1713200340000, requests: 18, failures: 1, averageLatencyMs: 64 },
  ],
};

describe("HealthGrid", () => {
  it("renders resizable wrappers around the table, latency chart, and failures panels", () => {
    render(<HealthGrid snapshot={snapshot} />);

    expect(screen.getByTestId("resizable-panel-health-table")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-health-chart")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-panel-health-failures")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.test.tsx`

Expected: FAIL with missing `resizable-panel-*` test ids and missing `HealthGrid.test.tsx`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// apps/web/src/features/overview/OverviewSummary.tsx
import { ResizablePanel } from "../../components/ResizablePanel";

<ResizablePanel
  panelId="overview-summary-hero"
  label="executive summary panel"
  defaultSize={{ width: 1180, height: 260 }}
  minSize={{ width: 760, height: 220 }}
  maxSize={{ width: 1320, height: 340 }}
  className="panel panel-full summary-hero"
>
  {/* existing executive summary content */}
</ResizablePanel>
```

```tsx
// apps/web/src/features/logs/LogsWorkspace.tsx
import { ResizablePanel } from "../../components/ResizablePanel";

<ResizablePanel
  panelId="logs-list"
  label="request logs panel"
  defaultSize={{ width: 720, height: 640 }}
  minSize={{ width: 420, height: 420 }}
  maxSize={{ width: 960, height: 860 }}
  className="panel panel-wide logs-workspace-list"
>
  {/* existing request logs content */}
</ResizablePanel>
```

```tsx
// apps/web/src/features/health/HealthGrid.tsx
import { ResizablePanel } from "../../components/ResizablePanel";

<ResizablePanel
  panelId="health-table"
  label="health table panel"
  defaultSize={{ width: 980, height: 420 }}
  minSize={{ width: 700, height: 320 }}
  maxSize={{ width: 1320, height: 620 }}
  className="panel panel-wide health-table-panel"
>
  {/* existing server health table */}
</ResizablePanel>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.test.tsx`

Expected: PASS with all targeted tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/overview/OverviewSummary.tsx apps/web/src/features/overview/OverviewSummary.test.tsx apps/web/src/features/logs/LogsWorkspace.tsx apps/web/src/features/logs/LogsWorkspace.test.tsx apps/web/src/features/health/HealthGrid.tsx apps/web/src/features/health/HealthGrid.test.tsx
git commit -m "feat: add resizable overview logs and health panels"
```

### Task 3: Make the topology workspace resize-aware

**Files:**
- Modify: `apps/web/src/pages/TopologyPage.tsx`
- Modify: `apps/web/src/pages/TopologyPage.test.tsx`
- Modify: `apps/web/src/features/topology/TopologyGraph.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/pages/TopologyPage.test.tsx
it("wraps the graph and support cards in resizable panels while preserving cluster toggling", () => {
  render(<TopologyPage />);

  expect(screen.getByTestId("resizable-panel-topology-graph")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-topology-edges")).toBeInTheDocument();
  expect(screen.getByTestId("resizable-panel-topology-insights")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /clusters/i }));

  expect(mockTopologyGraph).toHaveBeenLastCalledWith(
    expect.objectContaining({
      clustered: true,
      resizeSignal: expect.any(Number),
    }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/pages/TopologyPage.test.tsx`

Expected: FAIL with missing resize wrappers or missing `resizeSignal` prop expectations.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// apps/web/src/pages/TopologyPage.tsx
import { useState } from "react";
import { ResizablePanel } from "../components/ResizablePanel";

const [graphResizeSignal, setGraphResizeSignal] = useState(0);

<ResizablePanel
  panelId="topology-graph"
  label="topology graph panel"
  defaultSize={{ width: 980, height: 760 }}
  minSize={{ width: 720, height: 560 }}
  maxSize={{ width: 1400, height: 980 }}
  className="panel panel-wide summary-panel-dark topology-graph-panel"
  onResizeEnd={() => setGraphResizeSignal((value) => value + 1)}
>
  <TopologyGraph
    topologyElements={showClusters ? graphElements.clustered : graphElements.flat}
    tall
    clustered={showClusters}
    resizeSignal={graphResizeSignal}
    className="topology-graph-frame"
  />
</ResizablePanel>
```

```tsx
// apps/web/src/features/topology/TopologyGraph.tsx
import { useEffect, useRef } from "react";

export function TopologyGraph({ resizeSignal = 0, ...props }: TopologyGraphProps) {
  const cyRef = useRef<any>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.resize();
    cy.fit(cy.elements(), props.clustered ? 54 : 30);
  }, [resizeSignal, props.clustered, props.topologyElements]);

  return <div ref={frameRef} className="graph-wrap">...</div>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/pages/TopologyPage.test.tsx`

Expected: PASS with cluster toggling still green and resize wrappers present.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/TopologyPage.tsx apps/web/src/pages/TopologyPage.test.tsx apps/web/src/features/topology/TopologyGraph.tsx
git commit -m "feat: add resizable topology workspace"
```

### Task 4: Lighten dark surfaces, polish hover states, and run the full regression suite

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/features/overview/OverviewSummary.tsx`
- Modify: `apps/web/src/features/logs/LogsWorkspace.tsx`
- Modify: `apps/web/src/features/health/HealthGrid.tsx`
- Modify: `apps/web/src/pages/TopologyPage.tsx`

- [ ] **Step 1: Write the failing regression assertions**

```tsx
// apps/web/src/app/App.test.tsx
import { readFileSync } from "node:fs";

it("keeps analysis surfaces on lighter charcoal tokens and exposes hover-capable resizable panels", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  expect(css).toContain(".summary-panel-dark");
  expect(css).toContain("background: #1f2937");
  expect(css).toContain(".resizable-panel:hover");
  expect(css).toContain(".resize-handle-corner");
});
```

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `npm run test -w @mcp-atlas/web -- apps/web/src/app/App.test.tsx`

Expected: FAIL because the lighter charcoal tokens or hover/handle rules are not fully present yet.

- [ ] **Step 3: Write the minimal implementation**

```css
/* apps/web/src/styles.css */
.summary-panel-dark,
.logs-workspace-detail-dark,
.health-chart-surface,
.topology-graph-panel {
  background: #1f2937;
  border-color: #334155;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.resizable-panel:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
}

.resizable-panel-dragging {
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.18);
}

.resize-handle::after {
  content: "";
  display: block;
  background: rgba(15, 23, 42, 0.24);
}

.resize-handle:hover::after,
.resizable-panel-dragging .resize-handle::after {
  background: rgba(15, 23, 42, 0.76);
}

@media (max-width: 1023px) {
  .resizable-panel {
    width: auto !important;
    height: auto !important;
  }

  .resize-handle {
    display: none;
  }
}
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
git add apps/web/src/styles.css apps/web/src/app/App.test.tsx apps/web/src/features/overview/OverviewSummary.tsx apps/web/src/features/logs/LogsWorkspace.tsx apps/web/src/features/health/HealthGrid.tsx apps/web/src/pages/TopologyPage.tsx
git commit -m "feat: finalize interactive dashboard panels"
```
