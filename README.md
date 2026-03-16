# MCP Atlas

MCP Atlas is an observability dashboard for multi-MCP systems. It records live request flows, reconstructs traces, measures latency, tracks service health, builds dependency graphs, and surfaces anomalies.

This repository currently supports two practical modes:

- local live mode: Atlas proxies real HTTP requests across three lightweight MCP-like services
- Blaxel integration mode: Atlas can connect to a Blaxel sandbox MCP endpoint and discover workspace MCP functions

# Video Demonstration
https://github.com/user-attachments/assets/87a1d2d5-9ff5-4f31-92f7-3c10b5a88d16




## What Is Implemented

- live local services for `Search MCP`, `Memory MCP`, and `File MCP`
- Atlas proxy that forwards requests and emits telemetry from real traffic
- in-memory telemetry store with trace reconstruction
- overview, topology, health, and logs pages
- anomaly detection for failures, slow hops, slow traces, degraded services, and offline services
- trace export from Logs as Excel-compatible CSV
- Blaxel sandbox connection status endpoint
- authenticated backend-side Blaxel MCP connector
- Blaxel workspace MCP server discovery endpoint

## Repository Layout

- `apps/server`
  Atlas backend. Express + Socket.IO, telemetry aggregation, Atlas proxy routes, Blaxel integration.

- `apps/web`
  React + Vite frontend dashboard.

- `functions/atlas-blaxel-mcp`
  Deployable custom Blaxel MCP server exposing hosted Atlas tools over streamable HTTP.

- `services/search-mcp`
  Lightweight local search service.

- `services/memory-mcp`
  Lightweight local memory service.

- `services/file-mcp`
  Lightweight local file service.

- `logs`
  Runtime logs if you start background processes manually.

## Architecture

### Local Live Flow

```text
Browser
  |
  v
MCP Atlas Web
  |
  v
Atlas Proxy (apps/server)
  |
  +--> Search MCP  (4001)
  +--> Memory MCP  (4002)
  +--> File MCP    (4003)
```

Atlas proxy is the observability layer. It:

- receives requests
- assigns `traceId` and `requestId`
- forwards calls to downstream services
- measures latency
- records hop success or failure
- reconstructs traces
- streams dashboard snapshots over Socket.IO

### Blaxel Integration Flow

```text
MCP Atlas Server
  |
  +--> Blaxel Sandbox API / SDK
  +--> Blaxel Sandbox MCP endpoint
  +--> Blaxel Workspace MCP function discovery API
```

Atlas currently uses Blaxel in three ways:

- connect to or create a sandbox
- connect to an authenticated sandbox MCP endpoint
- list workspace MCP server functions from Blaxel
- call a hosted custom Blaxel MCP function and record those requests as Atlas telemetry

## Ports

Expected local ports:

- `5173` web frontend
- `4000` Atlas proxy/backend
- `4001` Search MCP
- `4002` Memory MCP
- `4003` File MCP

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+

### Install

```bash
npm install
```

### Run Everything

From the repository root:

```bash
npm run dev
```

This starts:

- web on `http://localhost:5173`
- Atlas proxy on `http://localhost:4000`
- Search MCP on `http://localhost:4001`
- Memory MCP on `http://localhost:4002`
- File MCP on `http://localhost:4003`

### Build

```bash
npm run build
```

## Environment Variables

See [.env.example](./.env.example).

Primary variables:

- `BL_API_KEY`
  Blaxel API key.

- `BL_WORKSPACE`
  Blaxel workspace name or ID.

- `BLAXEL_SANDBOX_NAME`
  Sandbox name to create or reconnect.

- `BLAXEL_SANDBOX_IMAGE`
  Sandbox base image.

- `BLAXEL_SANDBOX_MEMORY_MB`
  Sandbox memory in MB.

- `BLAXEL_SANDBOX_PORT`
  Exposed sandbox port.

- `BLAXEL_SANDBOX_REGION`
  Sandbox region.

- `BLAXEL_MCP_URL`
  Full MCP endpoint URL for the sandbox or hosted MCP server.

### Notes

- `.env` is gitignored.
- the backend explicitly loads the root `.env`
- the frontend uses Vite proxying to reach the backend during development

## Local Services

### Search MCP

Route:

- `POST /tool`

Example payload:

```json
{
  "query": "alignment dashboard"
}
```

### Memory MCP

Route:

- `POST /tool`

Example payload:

```json
{
  "topic": "alignment dashboard",
  "userId": "u1"
}
```

### File MCP

Route:

- `POST /tool`

Example payload:

```json
{
  "filename": "atlas-notes.txt"
}
```

Forced failure payload:

```json
{
  "filename": "atlas-notes.txt",
  "forceFailure": true
}
```

## Atlas Backend API

### Health and Snapshot

- `GET /health`
- `GET /api/snapshot`

### Local Service Registry

- `GET /api/services`

### Proxy Routes

- `POST /proxy/search-mcp`
- `POST /proxy/memory-mcp`
- `POST /proxy/file-mcp`

### Demo Flow

- `POST /api/demo/agent-task`

This produces a live multi-hop trace:

`Gateway MCP -> Search MCP -> Memory MCP -> File MCP`

### Blaxel Integration

- `GET /api/integrations/blaxel`
  Sandbox connection status.

- `GET /api/integrations/blaxel/mcp/ping`
  Server-side authenticated ping against the configured MCP endpoint.

- `GET /api/integrations/blaxel/mcp/tools`
  List tools from the configured Blaxel MCP endpoint.

- `POST /api/integrations/blaxel/mcp/tools/:toolName`
  Call a specific tool on the configured Blaxel MCP endpoint.

- `GET /api/integrations/blaxel/functions`
  List workspace MCP server functions from Blaxel.

- `GET /api/integrations/blaxel/functions/:functionName/test`
  Test-connect to a discovered workspace MCP function and list its tools.

- `GET /api/integrations/blaxel/functions/:functionName/tools`
  List tools exposed by a discovered or configured hosted Blaxel MCP function.

- `POST /api/integrations/blaxel/functions/:functionName/tools/:toolName`
  Call a hosted Blaxel MCP tool through Atlas and emit trace telemetry into the dashboard.

## Frontend Features

### Overview

- top-level metrics
- anomaly summary
- traffic trend chart
- alignment insights
- Blaxel MCP registry
- topology snapshot
- latest trace

### Topology

- dependency graph
- cluster toggle
- animated cluster view
- edge list

### Health

- service health table
- latency chart
- failure pressure view

### Logs

- recent traces list
- hop-by-hop trace detail
- export selected trace as Excel-compatible `.csv`

## Telemetry Model

Core event types:

- `HEARTBEAT`
- `REQUEST_RECEIVED`
- `REQUEST_FORWARDED`
- `REQUEST_COMPLETED`
- `REQUEST_FAILED`

Core fields include:

- `traceId`
- `requestId`
- `sourceMcp`
- `targetMcp`
- `eventType`
- `status`
- `latencyMs`
- `timestamp`
- `errorMessage`

All telemetry is currently stored in memory. There is no database yet.

## Anomaly Detection

Atlas currently raises anomalies for:

- failed traces
- slow hops
- slow end-to-end traces
- elevated p95 latency
- high failure rate
- offline services

These are computed in:

- [apps/server/src/store.ts](./apps/server/src/store.ts)

## Blaxel Notes

### Why Browser Access to `/mcp` Returns 401

Blaxel MCP endpoints require authentication headers. Opening the MCP URL directly in a browser will return:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

That is expected.

Atlas solves this by connecting from the backend and sending:

- `Authorization: Bearer <BL_API_KEY>`
- `X-Blaxel-Workspace: <BL_WORKSPACE>`

### Current Blaxel State

At the time of implementation:

- sandbox MCP endpoint connection works
- tool listing from sandbox MCP works
- workspace function discovery endpoint works
- Atlas can call a hosted Blaxel MCP function once it is deployed
- workspace function list may be empty if no MCP functions are deployed in the workspace

If `GET https://api.blaxel.ai/v0/functions` returns an empty array for your workspace, Atlas will not treat the hosted MCP function as live even if a guessed URL exists. In that state, requests to the hosted endpoint commonly fail with `Workload not found`, which indicates the function was not deployed successfully on Blaxel.

### Hosted Custom MCP Server

The repo now includes a deployable hosted MCP server at:

- [functions/atlas-blaxel-mcp/src/server.ts](./functions/atlas-blaxel-mcp/src/server.ts)

It exposes four tools:

- `atlasSearch`
- `atlasMemory`
- `atlasFile`
- `atlasAgentTask`

Deployment config lives in:

- [functions/atlas-blaxel-mcp/blaxel.toml](./functions/atlas-blaxel-mcp/blaxel.toml)

Expected hosted endpoint after deployment:

```text
https://run.blaxel.ai/<workspace>/functions/mcp-atlas-tools/mcp
```

Recommended deploy flow from that folder:

```bash
bl serve --hotreload
bl deploy
```

After deployment, Atlas will discover `mcp-atlas-tools` from Blaxel or synthesize its expected URL from `BLAXEL_ATLAS_FUNCTION_NAME` and show it in the `Blaxel MCP Registry`.

## Known Limitations

- telemetry is in-memory only
- no PostgreSQL or Supabase persistence yet
- no auth layer on Atlas itself
- local services are HTTP MCP-like services, not full MCP protocol servers
- bundle size is still large on the frontend
- Blaxel workspace discovery only lists deployed MCP functions; it does not itself generate traces
- the Blaxel CLI is not installed in this environment, so deployment must be run from your machine after logging into Blaxel

## Suggested Next Steps

- persist traces and metrics in PostgreSQL or Supabase
- add filtering and search across traces
- ingest external real MCP traffic into the Atlas telemetry schema
- unify local services, sandbox MCP tools, and workspace MCP functions into one observable registry
- add richer per-tool telemetry for Blaxel MCP calls
- reduce frontend bundle size with route-level code splitting

## Useful Commands

Run all services:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Run only backend:

```bash
npm run dev -w @mcp-atlas/server
```

Run only frontend:

```bash
npm run dev -w @mcp-atlas/web
```

Run only one service:

```bash
npm run dev -w @mcp-atlas/search-mcp
```

## File References

Main backend:
- [apps/server/src/index.ts](./apps/server/src/index.ts)
- [apps/server/src/store.ts](./apps/server/src/store.ts)
- [apps/server/src/services.ts](./apps/server/src/services.ts)
- [apps/server/src/blaxel.ts](./apps/server/src/blaxel.ts)
- [apps/server/src/blaxel-mcp.ts](./apps/server/src/blaxel-mcp.ts)
- [apps/server/src/blaxel-functions.ts](./apps/server/src/blaxel-functions.ts)

Frontend:
- [apps/web/src/App.tsx](./apps/web/src/App.tsx)
- [apps/web/src/styles.css](./apps/web/src/styles.css)

Local services:
- [services/search-mcp/src/index.ts](./services/search-mcp/src/index.ts)
- [services/memory-mcp/src/index.ts](./services/memory-mcp/src/index.ts)
- [services/file-mcp/src/index.ts](./services/file-mcp/src/index.ts)
