# MCP Atlas Resizable Dashboard Panels Design

**Date:** 2026-04-16

## Goal

Refine the minimalist UI refresh so the dashboard feels lighter and more interactive by:

- softening the current dark analysis surfaces so they read as charcoal instead of near-black
- adding subtle hover elevation to major dashboard panels
- allowing desktop users to resize major panels by dragging their edges
- resetting all panel sizing when the page reloads

This change keeps the existing application shell, routing model, and backend contracts intact.

## Scope

This design applies to the frontend only and builds on the approved minimalist UI refresh.

In scope:

- lighter dark surfaces for graphs, charts, and trace-detail areas
- hover interaction for major panels and cards
- desktop-only drag resizing for major panels on `Overview`, `Topology`, `Logs`, and `Health`
- page-level resize constraints so layouts stay usable
- frontend tests covering the new interaction model

Out of scope:

- backend API changes
- panel drag-and-drop reordering
- persistence of resized layouts
- mobile or tablet touch resizing
- replacing charting or topology libraries

## Why This Change

The current branch improves the shell and navigation, but two interaction issues remain:

1. the dark analysis surfaces are still visually heavier than they need to be
2. the dashboard panels are static even on desktop, which limits investigation workflows on pages like `Topology` and `Logs`

The objective is not to turn MCP Atlas into a freeform dashboard builder. The objective is to keep the page-based product structure while giving desktop users controlled layout flexibility.

## Design Principles

### Keep The Shell Calm

The shell remains white and minimal. Interactivity should come through motion, borders, and handles, not louder colors.

### Preserve Data Contrast

Dark graph and trace surfaces remain dark because they improve observability readability, but they should shift from near-black to softer charcoal/slate tones so they stop dominating the interface.

### Resize Without Breaking Information Hierarchy

Users can resize major panels, but only within constrained bounds. The pages should remain understandable and well-structured even after resizing.

### Desktop Capability, Mobile Stability

Resizing is desktop-only. Smaller breakpoints keep the fixed responsive layout so the app remains stable on touch devices.

## Visual Treatment

### Analysis Surfaces

The current dark surfaces should be lightened to a charcoal/slate range. They should still provide strong contrast for graph nodes, edge labels, traces, and charts, but they should feel embedded inside the light shell instead of visually overpowering it.

Expected changes:

- reduce pure-black or near-black fills
- reduce heavy glow around graph and trace surfaces
- use restrained shadows and borders instead of dense visual weight

### Hover Elevation

Every major panel should respond to hover with a subtle lift:

- small upward translation
- slightly stronger shadow
- slightly clearer border or focus treatment

This should read as a restrained workspace affordance, not as a card carousel animation.

### Resize Handles

Major panels gain resize handles on desktop:

- right edge handle for width adjustment
- bottom edge handle for height adjustment
- bottom-right corner handle for combined resize

Handles should remain visually quiet in the resting state and become clearer on hover or during drag.

## Shared Resize Behavior

The frontend adds a reusable `ResizablePanel` wrapper for major panels.

Responsibilities:

- hold temporary width and height state in memory only
- expose drag handles on desktop breakpoints
- apply min and max constraints per panel
- reset to default dimensions when the page refreshes
- keep wrapped content components unchanged as much as possible

The resize state is session-local. No persistence layer is added, and no layout state is sent to the backend.

## Desktop-Only Behavior

Desktop:

- resizing enabled
- hover elevation enabled
- drag handles rendered

Tablet and mobile:

- no resize handles
- no drag resizing
- layout falls back to the fixed responsive page composition

This keeps the interaction model coherent and avoids fragile touch behavior.

## Page-Level Behavior

### Overview

All major summary panels become resizable, but constraints stay conservative because this page is still an executive summary.

Resizable panels include:

- executive summary hero
- anomalies panel
- traffic pulse
- topology preview
- latest trace
- registry coverage

Resizing on this page should support emphasis, not full customization. Panels must not shrink below readable metric and content thresholds.

### Topology

`Topology` gets the most visible benefit from resizing.

Resizable panels include:

- main graph panel
- dependency edges panel
- alignment insights panel

Users should be able to give more room to the graph or expand supporting context without losing the page structure.

### Logs

`Logs` is the other high-value resizing page.

Resizable panels include:

- request logs list
- trace detail panel

This allows users to bias the page toward browsing many traces or deeply reading a selected trace. Export remains anchored in the trace detail header.

### Health

Major health panels become resizable so users can allocate more height to status-heavy sections or wider room to denser operational summaries.

Constraints remain important so the page does not collapse below readable table/card widths.

## Layout And Rendering Rules

The app keeps its existing route-level page composition. This is not a grid-library rewrite.

Implementation rules:

- no drag-to-reorder
- no freeform placement
- no overlap between panels
- resized panels stay within page-controlled flow layouts
- each page defines default size, minimum size, and maximum size for each major panel

The layout remains product-structured, not dashboard-builder structured.

## Frontend Components

Add a shared `ResizablePanel` component under the frontend component/app layer.

It should:

- wrap an existing panel surface
- manage pointer events for edge dragging
- expose orientation-specific resize handles
- apply inline dimensions or CSS custom properties for live resize updates
- publish dragging state for styling

Add a small helper or hook to:

- detect desktop breakpoints
- centralize size constraints
- simplify reuse across pages

## Integration With Existing Pages

Update:

- `apps/web/src/pages/OverviewPage.tsx`
- `apps/web/src/pages/TopologyPage.tsx`
- `apps/web/src/pages/LogsPage.tsx`
- `apps/web/src/pages/HealthPage.tsx`

The page responsibility remains:

- choose which panels are major
- set sensible resize bounds
- preserve default grid structure

The wrapper should be inserted around the existing panel composition rather than forcing major feature components to own resize logic.

## Styling System

Update `apps/web/src/styles.css` to add:

- lighter charcoal analysis-surface tokens
- hover-lift transitions
- resize-handle styles
- drag-state styles
- desktop-only interaction rules for handles

The styling work should be centralized enough that the visual system stays consistent across pages.

## Graph And Chart Considerations

Resizing panels that contain Cytoscape or chart surfaces can cause stale rendering dimensions if the child library does not react automatically.

Implementation must ensure:

- topology graph recalculates on panel resize
- charts reflow after size changes if their container does not already handle it automatically

This is a required part of the implementation, not a polish item.

## Testing Strategy

Frontend tests should cover:

- desktop-only handle visibility
- hover class/state behavior where practical
- resize interaction updating panel dimensions
- default layout returning after remount or refresh path
- existing page content still rendering correctly inside resizable wrappers

Full verification should include:

- `npm run test`
- `npm run build`

## Risks

### CSS Sprawl

If resizing behavior is introduced panel-by-panel, the stylesheet and page code will become hard to maintain. The shared wrapper is required to contain this complexity.

### Rendering Reflow Bugs

Graph and chart containers may not fully respond to container size changes without explicit reflow handling.

### Over-Flexibility

If panel bounds are too loose, the dashboard becomes awkward instead of useful. Each page must define conservative constraints that preserve readability.

## Success Criteria

This change is successful if:

- dark analysis surfaces feel lighter without reducing readability
- major panels visibly respond to hover in a restrained way
- desktop users can resize major panels on all main pages
- layouts remain stable and readable within constraints
- resizing resets on refresh
- the existing responsive mobile experience remains intact
