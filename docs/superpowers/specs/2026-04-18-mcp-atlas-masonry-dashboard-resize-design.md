# MCP Atlas Masonry Dashboard Resize Design

**Date:** 2026-04-18

## Goal

Refine the desktop resizing system so it feels intentional and visually minimal by:

- replacing the current thick resize bars with thin border-like resize affordances
- allowing resized cards to trigger masonry-style repacking that closes layout gaps immediately
- preserving free pixel dragging instead of snapped span-based resizing
- keeping the existing mobile and tablet responsive layout unchanged

This change builds on the approved minimalist UI refresh and the first resizable-panel pass.

## Scope

This design applies to the frontend only.

In scope:

- desktop masonry layout orchestration for major dashboard panels
- thin edge and corner resize affordances
- free pixel width and height resizing
- automatic gap-filling repack after resize
- animated repositioning of neighboring cards after layout changes
- page-specific bounds for `Overview`, `Topology`, `Logs`, and `Health`
- frontend tests for packing and resize behavior

Out of scope:

- backend API changes
- layout persistence across refreshes
- mobile or tablet resizing
- drag-and-drop placement by the user
- panel overlap
- changing the navigation or shell structure

## Why This Change

The current desktop resize implementation proves the interaction path, but two problems remain:

1. the resize affordance reads like a thick scrollbar instead of a card edge
2. resized cards keep rigid grid behavior, which leaves visual holes instead of letting the board repack

The goal is not a dashboard builder. The goal is a cleaner investigative workspace where cards resize freely and the board repacks itself with less wasted space.

## Design Principles

### Keep Resize Controls Quiet

Resize affordances should read like part of the card border, not like separate UI bars.

### Repack Immediately

If a card shrinks or grows, neighboring cards should move into newly available space. Empty gaps should not linger.

### Preserve Freeform Feel

Resizing should remain pixel-based, not snapped to layout spans or grid units.

### Keep Product Structure Intact

Routes, shell, page ownership, and content components remain intact. The layout engine changes, not the product model.

## Interaction Model

Major dashboard panels become cards rendered inside a shared masonry workspace on desktop.

Behavior:

- cards are resizable through thin interactive edges and a corner grip
- resizing updates width and height in pixels
- after resize, the workspace recomputes packed positions and moves other cards to close gaps
- lower cards may move into new positions and reorder visually
- DOM order remains stable even if visual positions change
- refresh resets all card sizes and layout to defaults

Desktop only:

- resizing enabled
- packed masonry layout enabled

Tablet and mobile:

- fixed responsive layout remains
- resize affordances are not rendered

## Visual Treatment

### Resize Affordances

The current thick full-length bars should be replaced with subtle border-like indicators.

Expected treatment:

- default state: almost invisible thin edge accent integrated into the card border
- hover state: slightly darker active edge
- drag state: focused ring plus stronger active edge, but still thin
- corner handle: a small diagonal grip, not a square block

The control must feel like part of the card, not like a scrollbar.

### Motion

Cards keep the existing restrained hover lift.

When layout repacks:

- neighboring cards animate into new positions
- the dragged card stays visually above surrounding cards during interaction
- movement should feel deliberate, not jittery or abrupt

### Surfaces

The existing minimalist shell remains:

- white shell
- black primary buttons
- charcoal graph and chart surfaces

This change does not introduce a new color system. It refines layout behavior and affordances.

## Layout Model

The current desktop `dashboard-grid` behavior is not sufficient for this requirement.

Desktop pages should instead use a shared masonry workspace that:

- measures the available container width
- stores current card widths and heights in memory
- computes packed card positions
- renders cards with explicit positions
- sets workspace height from the packed result

The packing model should favor:

- filling the earliest available space
- moving cards upward and leftward where possible
- preserving card bounds
- avoiding overlaps

This is a page-level layout engine, not a global application-wide drag surface.

## Page-Level Behavior

### Overview

The summary panels become masonry-packed cards:

- executive summary
- anomalies
- quick links
- traffic pulse
- topology preview
- latest trace
- registry coverage

These cards may visually reorder to close gaps after resize.

### Logs

The logs workspace becomes a masonry board with:

- request logs
- trace detail

If the request list becomes narrower or shorter, trace detail may shift to fill the best available slot.

### Health

The health workspace becomes a masonry board with:

- server health table
- latency chart
- failures panel

The table remains the dominant card by default, but smaller cards may move around it as space changes.

### Topology

The topology workspace becomes a masonry board with:

- network graph
- dependency edges
- alignment insights

The graph remains the dominant artifact, but supporting cards should repack around it instead of leaving rigid grid holes.

## Shared Components

### ResizablePanel

Keep `ResizablePanel` as the resize primitive, but change its responsibilities:

- render thin edge and corner affordances
- manage pointer events and pixel-based size changes
- publish drag state and current size to the parent workspace
- stop relying on full-length thick handle visuals

### MasonryWorkspace

Add a new shared `MasonryWorkspace` component that:

- accepts a set of cards and their default sizes
- computes packed positions for desktop
- renders cards in stable DOM order
- animates visual position changes after resize
- disables itself under the desktop breakpoint

Each page owns:

- which cards participate
- default sizes
- minimum sizes
- maximum sizes

## Integration With Existing Pages

Update:

- `apps/web/src/features/overview/OverviewSummary.tsx`
- `apps/web/src/features/logs/LogsWorkspace.tsx`
- `apps/web/src/features/health/HealthGrid.tsx`
- `apps/web/src/pages/TopologyPage.tsx`

These pages should stop relying on rigid desktop grid spans for major panels and instead provide cards to the masonry workspace.

The responsive breakpoint behavior remains CSS-driven for smaller screens.

## Graph And Chart Considerations

The topology graph and chart surfaces still need explicit resize awareness.

Implementation must ensure:

- Cytoscape reflows after the masonry layout settles
- chart containers continue to render correctly after packed layout changes

This is required behavior, not polish.

## Testing Strategy

Frontend tests should cover:

- thin resize affordance rendering
- desktop-only masonry behavior
- packer behavior filling holes after resize
- cards moving into new positions when space opens
- min and max bounds staying enforced
- topology graph resize callback still firing

Verification should include:

- `npm run test`
- `npm run build`

## Risks

### Packing Instability

If the packer recalculates too aggressively during drag, cards may jitter. The implementation must control when repacking occurs and how transitions are animated.

### Accessibility Drift

Absolute positioning can create a mismatch between visual order and DOM order. DOM order must remain stable so keyboard and screen-reader flow stay coherent.

### Visual Noise

If resize indicators or movement effects are too strong, the minimalist UI will regress. Borders and motion need restraint.

### Graph Reflow Bugs

Topology and charts may render stale dimensions unless the layout engine explicitly triggers resize handling after state changes.

## Success Criteria

This change is successful if:

- resize handles no longer look like thick bars
- desktop cards resize in free pixels
- neighboring cards repack to close gaps after resize
- visual reordering is smooth and readable
- page structure remains understandable
- mobile and tablet behavior stays fixed and stable
