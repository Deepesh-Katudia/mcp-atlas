# MCP Atlas Platform Refactor Design

**Date:** 2026-04-12

**Goal**

Refactor MCP Atlas into a clearer frontend/backend architecture where the frontend consumes a stable backend API, the backend exposes normalized application endpoints, and multiple observable MCP servers are integrated through a pluggable adapter model that supports both local services and Blaxel-backed MCPs in real time.

## Scope

This design covers the first structural refactor of the existing repo. It does not redesign the product UI feature-by-feature. The immediate objective is to establish maintainable boundaries so subsequent UI work and new MCP integrations can be added one feature at a time without growing the current monolithic files.

## Current Problems

- The backend entrypoint in `apps/server/src/index.ts` mixes HTTP routes, orchestration, telemetry shaping, Blaxel integration, service registry logic, and socket broadcasting.
- The frontend entrypoint in `apps/web/src/App.tsx` mixes routing, data fetching, layout, chart configuration, control actions, topology rendering, and export logic.
- The frontend and backend duplicate API contracts and telemetry shapes instead of consuming one shared contract package.
- Local MCP services are observable, but the backend does not model them through one adapter interface that can also represent Blaxel-backed MCP servers.
- Generated JavaScript files exist beside TypeScript source in the frontend source tree, which makes the source layout noisy and error-prone.

## Target Architecture

### Repository Shape

```text
mcp-atlas/
  apps/
    api/
      src/
        app/
        routes/
        modules/
          telemetry/
          topology/
          logs/
          anomalies/
          mcp-registry/
          controls/
        adapters/
          local/
          blaxel/
        lib/
    web/
      src/
        app/
        pages/
        features/
          overview/
          topology/
          logs/
          health/
          controls/
          registry/
        components/
        api/
        hooks/
        lib/
  packages/
    contracts/
  services/
    search-mcp/
    memory-mcp/
    file-mcp/
```

### Architectural Boundaries

- `apps/api` is the only application backend exposed to the frontend.
- `services/*` remain separate runtime MCP services for local observation and demo traffic.
- `packages/contracts` contains shared request, response, telemetry, topology, and MCP registry types used by both `apps/api` and `apps/web`.
- Backend adapters hide transport differences between local HTTP MCPs and Blaxel sandbox MCP calls.
- Frontend features are organized by product area rather than one large app-level file.

## Backend Design

### API Responsibilities

The API server becomes the control plane for the application. It is responsible for:

- exposing frontend-facing REST endpoints
- emitting real-time socket updates
- maintaining telemetry state and derived metrics
- coordinating MCP calls through adapters
- surfacing registry, health, trace, anomaly, and topology data

### Backend Modules

#### `modules/mcp-registry`

Owns the normalized view of available MCP servers and their tools. It combines:

- local MCP service registrations
- Blaxel sandbox MCP registration
- future adapter-backed MCP sources

This module returns the canonical MCP list used by the dashboard.

#### `modules/controls`

Owns user-triggered actions such as:

- run agent task
- call one MCP directly
- trigger a failure
- call Blaxel sandbox MCP

The module delegates the actual work to adapters and telemetry services.

#### `modules/telemetry`

Owns raw event ingestion, trace reconstruction, rolling metrics, tool invocation metrics, request volume, and socket payload shaping.

#### `modules/topology`

Builds graph nodes and edges from MCP registry data, inter-MCP traffic, and tool-to-MCP relationships.

#### `modules/logs`

Owns trace detail retrieval and export payload shaping.

#### `modules/anomalies`

Owns anomaly detection and anomaly feed generation based on telemetry thresholds and service health.

### Adapter Interface

Each MCP source should implement one common runtime contract. At minimum, the adapter interface should support:

- `listTools()`
- `healthcheck()`
- `callTool(toolName, payload)`
- `describeServer()`

Two adapter families are required immediately:

- local HTTP adapters for `search-mcp`, `memory-mcp`, and `file-mcp`
- Blaxel sandbox adapter for authenticated sandbox MCP tool calls

The backend should not care whether a request is served by local HTTP or Blaxel streamable MCP once the adapter is selected.

### Backend Endpoints

The frontend-facing backend should converge on a small stable surface:

- `GET /api/snapshot`
- `GET /api/registry/mcps`
- `GET /api/topology`
- `GET /api/traces`
- `GET /api/traces/:traceId`
- `GET /api/anomalies`
- `POST /api/controls/agent-task`
- `POST /api/controls/mcps/:mcpSlug/tools/:toolId`
- `POST /api/controls/failure`
- `POST /api/controls/blaxel/processes-list`
- `GET /health`

The current mixed naming should be phased out after the frontend is migrated.

## Frontend Design

### Frontend Responsibilities

The frontend should stop building the app from one file. Its responsibilities should be split into:

- route-level pages
- feature modules for each dashboard area
- shared UI components
- typed API clients
- reusable socket/data hooks

### Frontend Pages

- `OverviewPage`
- `TopologyPage`
- `LogsPage`
- `HealthPage`

### Frontend Feature Modules

#### `features/controls`

Owns the action buttons and request execution state.

#### `features/overview`

Owns top-line metrics, anomaly summary, live throughput charts, and summary cards.

#### `features/topology`

Owns graph data transformation, Cytoscape configuration, cluster overlays, and graph interaction controls.

#### `features/logs`

Owns trace list, trace detail, export behavior, and trace filters.

#### `features/registry`

Owns MCP registry display, tool lists, and backend connection test state.

#### `features/health`

Owns per-MCP health and latency panels.

### Shared Contracts

The frontend should import all API-facing types from `packages/contracts` rather than duplicating local definitions. This removes drift between the backend payload shape and the React code.

## Real-Time MCP Observation Model

The application should continue running multiple MCP servers in real time. The backend observes them through adapters and records:

- MCP-to-MCP request edges
- tool-to-MCP request edges
- per-tool request count and latency
- per-MCP health and latency
- trace-level end-to-end timing

The topology graph should therefore display both:

- server dependency traffic
- tool activity attached to the MCP that owns the tool

This preserves the current product direction while making the backend implementation cleaner.

## Data Flow

1. A frontend control calls an API endpoint in `apps/api`.
2. The controls module chooses the correct adapter for the target MCP.
3. The adapter invokes the MCP tool and returns normalized result data.
4. Telemetry ingests request, success, latency, and failure events.
5. Derived modules recalculate traces, anomalies, topology, and tool metrics.
6. The API returns the immediate result and emits updated socket payloads.
7. The frontend refreshes the visible pages from the normalized snapshot and specialized endpoints.

## Error Handling

- Adapter failures should be normalized into a backend error shape before reaching the frontend.
- A failing MCP should emit telemetry failure events even if the HTTP endpoint returns an error.
- Registry entries should remain visible even when their healthcheck fails.
- Blaxel connectivity problems should degrade only the Blaxel adapter, not the entire backend.
- Topology rendering should tolerate missing tool metrics and empty registries.

## Testing Strategy

Implementation should use TDD. The first code change in each slice must be a failing test.

Backend tests should cover:

- adapter contract behavior
- endpoint payload shapes
- telemetry derivation
- anomaly generation
- topology transformation

Frontend tests should cover:

- page-level rendering from typed mock payloads
- controls feature behavior
- topology graph data transformation
- logs export behavior

For the refactor itself, work should be staged so that each migration slice preserves a running application and passes verification before the next commit.

## Commit Strategy

Refactor and feature work should be committed in small slices that match architectural milestones:

1. create shared contracts package
2. split backend modules and route boundaries
3. introduce MCP adapter interface
4. migrate local MCP services behind adapters
5. migrate Blaxel sandbox integration behind adapter
6. split frontend into pages and features
7. normalize frontend API client usage
8. clean generated source artifacts and finalize verification

This provides the per-feature Git history requested for the remote repository without forcing a risky one-shot rewrite.

## Non-Goals

- redesigning every dashboard interaction in this refactor
- replacing the local MCP services with hosted production services
- changing the product telemetry model beyond what is needed for modularization
- introducing a database in this step

## Recommended Next Step

Write an implementation plan for the refactor in commit-sized slices, then execute it with TDD from the backend contract boundary outward.
