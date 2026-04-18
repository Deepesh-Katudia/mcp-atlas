# MCP Atlas Minimalist UI Refresh Design

**Date:** 2026-04-14

**Goal**

Redesign the MCP Atlas frontend into a minimalist light interface with a white application shell, black primary actions, simpler navigation, and clearer page hierarchy while preserving dark graph and chart surfaces where contrast is needed for observability.

## Scope

This design covers the frontend experience only. It reshapes the application shell, navigation, visual language, and page composition for `Overview`, `Topology`, `Logs`, and `Health`. It does not change the backend architecture, telemetry model, MCP adapter system, or dashboard data contracts established by the platform refactor.

## Why This Change

The current UI is visually dense and shell-heavy. It uses a dark, glassy dashboard treatment across almost every surface, which makes the application feel louder than it needs to be and reduces the distinction between structural chrome and actual operational data. The redesign should:

- make navigation easier for first-time users
- reduce visual fatigue during longer sessions
- keep high-contrast graph and chart surfaces where users benefit from them
- present the `Overview` page as a clear summary instead of another full-detail operations page

## Current Problems

- The current shell in `apps/web/src/app/App.tsx` leads with a hero and top navigation that compete with the actual application content.
- The global stylesheet in `apps/web/src/styles.css` applies one dark glass treatment to nearly every component, which flattens information hierarchy.
- `Overview` is too close to a full dashboard instead of acting as an executive landing page.
- The current navigation model does not scale cleanly as the application adds more views and MCP-focused sections.
- Buttons and panels visually compete with charts and topology views instead of framing them.

## Design Principles

### Minimal Shell, Strong Data Contrast

- The shell should be quiet, white, and structured.
- Operational visualizations should remain dark where contrast materially improves readability.
- The application should feel calmer, but never less usable.

### Navigation First

- Users should understand where they are and where to go next without relying on page-level explanation text.
- Navigation should stay stable across the whole app.

### White/Black Core Palette

- White is the default shell and card background.
- Black is the primary action color.
- Gray is used for borders, dividers, muted labels, and secondary surfaces.
- Red, amber, and green remain reserved for operational state and anomalies.

### Summary Before Detail

- `Overview` should tell users what matters now.
- Detailed investigation belongs in dedicated pages like `Topology`, `Logs`, and `Health`.

## Proposed Experience

### Application Shell

The app becomes a two-column layout:

- a persistent left sidebar for desktop navigation
- a main content column for page content

The sidebar contains:

- product name and a short one-line description
- primary navigation links
- compact live system status
- optional secondary metadata such as last snapshot time

The main content area contains:

- a smaller page title row
- optional page-specific actions
- the content grid for the current route

The current hero section is removed. The shell should feel more like a product workspace and less like a promotional dashboard.

### Navigation Model

The primary navigation remains:

- `Overview`
- `Topology`
- `Logs`
- `Health`

Desktop behavior:

- sidebar is always visible
- active route is shown through a strong black selection state with clear text contrast

Mobile behavior:

- sidebar collapses into a top drawer or compact menu trigger
- navigation remains reachable without hiding page titles or actions

The navigation system must stay simple enough to absorb future sections such as MCP registry views or tool drilldowns without redesigning the shell again.

## Visual System

### Shell And Surfaces

- page background: pure white
- main cards: white with subtle gray borders
- spacing: wider, cleaner, less compressed than the current dashboard
- shadows: restrained, used only to separate layers, not as a visual motif

### Buttons

- primary buttons: black background, white text, black border
- secondary buttons: white background, black text, black or gray border
- destructive buttons: white background with red border and red text

This keeps the system simple and predictable instead of relying on multiple saturated accent families.

### Typography

- reduce oversized hero typography
- use smaller, sharper page titles
- use muted labels for secondary copy
- keep metric values bold and easy to scan

Typography should read like a control surface, not marketing copy.

### Dark Data Islands

The following remain dark:

- topology graph canvas
- traffic chart surface
- any trace-timeline surface where dark contrast improves hop readability

These dark surfaces should be embedded within the white shell as deliberate analysis zones, not as the default application background.

## Page Composition

### Overview

`Overview` becomes an executive summary page.

Primary structure:

- top row with four essential metrics
- active anomalies summary block
- one compact traffic panel
- one compact topology preview
- one summary card or panel each for:
  - health status
  - recent trace/log activity
  - Blaxel or MCP registry summary

The page should help a user answer:

- is the system healthy?
- are there active anomalies?
- where should I go next?

It should not try to expose every deep-dive control and data surface at once.

### Topology

`Topology` becomes the main graph investigation page.

- larger graph area
- less surrounding shell chrome
- dark graph surface preserved
- supporting edge or cluster summaries presented in simpler white cards around it

The graph should feel like the focal artifact of the page.

### Logs

`Logs` becomes more document-like and easier to read.

- trace list on one side
- selected trace detail on the other
- export action placed clearly near the trace detail heading
- trace detail surface remains dark for hop readability against the light shell

The page should prioritize scanability and sequential reading over decorative styling.

### Health

`Health` becomes cleaner and more tabular.

- server status and metrics should read like operational records
- reduced decorative cards
- clearer emphasis on status, throughput, latency, and error rate

The goal is quick scanning, not visual novelty.

## Component-Level Changes

### App Shell

`apps/web/src/app/App.tsx` should be reshaped so that:

- the current hero is removed
- layout responsibility moves to a sidebar + content shell
- navigation becomes structurally central instead of visually secondary
- per-page actions are easier to slot into the page header area

### Feature Composition

Page components under `apps/web/src/pages` should be updated so the shell no longer carries presentation assumptions from the current dark dashboard.

Likely effects:

- `OverviewPage.tsx` gets the largest composition change
- `TopologyPage.tsx` mostly gets layout and framing changes
- `LogsPage.tsx` and `HealthPage.tsx` primarily get stylistic and spacing changes

### Styling System

`apps/web/src/styles.css` should be treated as a controlled redesign pass:

- invert the shell from dark to light
- introduce sidebar layout styles
- simplify card styles and button styles
- preserve dark surface classes for charts and topology
- reduce or remove glass, blur, and radial shell backgrounds

This is intentionally not a tiny CSS tweak. The current stylesheet encodes the old design language broadly, so the update should make the new system explicit rather than layering overrides on top of old assumptions.

## Data And API Impact

No new backend endpoints are required for this redesign.

The current frontend data model already exposes:

- snapshot overview metrics
- anomalies
- traces
- topology/dependency data
- registry data
- action endpoints

If implementation reveals a small missing UI helper, it should only be added if it is derived directly from existing snapshot data and does not broaden backend scope.

## Responsive Behavior

Desktop:

- sticky sidebar
- main content with comfortable padding
- grid layouts retained where useful

Tablet:

- sidebar may narrow but should remain usable
- panel layout collapses with fewer columns

Mobile:

- navigation collapses into a compact menu
- metric and panel grids become single-column
- graph surfaces remain usable without the shell becoming cramped

The redesign must not trade desktop cleanliness for mobile breakage.

## Risks

### Stylesheet Coupling

The current stylesheet is deeply coupled to the old dark shell. This means the redesign should be implemented as a purposeful system shift, not a stack of small overrides.

### Over-Minimalization

A white minimalist shell can become too flat or too quiet for an observability product. This is why dark data islands and state colors remain part of the design.

### Overview Scope Creep

If `Overview` tries to remain a full dashboard, the redesign will fail. The implementation should protect the executive-summary scope of that page.

## Verification Strategy

Implementation should verify:

- existing frontend tests still pass
- full workspace build still passes
- `Overview`, `Topology`, `Logs`, and `Health` all render correctly
- sidebar navigation works on desktop and small screens
- dark graph/chart surfaces remain readable inside the light shell
- button hierarchy is consistent across actions
- anomaly and status colors remain readable and meaningful

## Out Of Scope

This redesign does not include:

- backend API redesign
- new telemetry concepts
- new MCP execution flows
- charting library replacement
- topology interaction redesign beyond layout and presentation improvements
- new branding system beyond the minimal shell treatment described here
