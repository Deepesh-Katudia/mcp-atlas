# MCP Atlas Platform Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor MCP Atlas into a modular platform with a typed contracts package, a backend control-plane API with pluggable MCP adapters, and a frontend split into pages and features that consumes stable backend endpoints.

**Architecture:** Keep the local MCP services as separate runtimes under `services/*`, but move all frontend-facing orchestration into `apps/api`. Introduce `packages/contracts` as the single source of truth for payload types and schemas, then migrate local and Blaxel MCP integrations behind a common adapter interface before decomposing the React app into route-level pages and feature modules.

**Tech Stack:** TypeScript, Express, Socket.IO, React, Vite, Cytoscape, Recharts, Zod, Vitest, React Testing Library, Supertest

---

### Task 1: Create Shared Contracts Package And Test Harness

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/dashboard.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/dashboard.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the contracts workspace shell**

Create `packages/contracts/package.json`:

```json
{
  "name": "@mcp-atlas/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "vitest": "^3.1.1"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing contracts test**

Create `packages/contracts/src/dashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DashboardSnapshotSchema, McpRegistryRecordSchema } from "./dashboard";

describe("DashboardSnapshotSchema", () => {
  it("parses a valid dashboard snapshot", () => {
    const parsed = DashboardSnapshotSchema.parse({
      generatedAt: Date.now(),
      overview: {
        totalServers: 5,
        activeServers: 5,
        requestsLastMinute: 12,
        averageLatencyMs: 180,
        failedRequests: 1,
        anomalyCount: 2
      },
      servers: [],
      toolsets: [],
      traces: [],
      dependencies: [],
      alerts: [],
      timeseries: []
    });

    expect(parsed.overview.totalServers).toBe(5);
  });

  it("rejects a snapshot without overview", () => {
    expect(() =>
      DashboardSnapshotSchema.parse({
        generatedAt: Date.now(),
        servers: [],
        toolsets: [],
        traces: [],
        dependencies: [],
        alerts: [],
        timeseries: []
      }),
    ).toThrow();
  });
});

describe("McpRegistryRecordSchema", () => {
  it("parses an MCP registry record", () => {
    const parsed = McpRegistryRecordSchema.parse({
      slug: "search-mcp",
      name: "Search MCP",
      transport: "http",
      status: "online",
      tools: [
        {
          id: "search",
          name: "search",
          description: "Search the knowledge base",
          requestCount: 3,
          averageLatencyMs: 120
        }
      ]
    });

    expect(parsed.tools[0]?.id).toBe("search");
  });
});
```

- [ ] **Step 3: Run the contracts test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/contracts
```

Expected: FAIL with `Cannot find module './dashboard'` or missing export errors.

- [ ] **Step 4: Implement the minimal shared schemas and exports**

Create `packages/contracts/src/dashboard.ts`:

```ts
import { z } from "zod";

export const EventTypeSchema = z.enum([
  "REQUEST_RECEIVED",
  "REQUEST_FORWARDED",
  "REQUEST_COMPLETED",
  "REQUEST_FAILED",
  "HEARTBEAT"
]);

export const EventStatusSchema = z.enum(["ok", "error", "info"]);

export const McpNameSchema = z.enum([
  "Gateway MCP",
  "Search MCP",
  "Memory MCP",
  "File MCP",
  "Atlas Blaxel MCP"
]);

export const McpToolInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  requestCount: z.number(),
  averageLatencyMs: z.number()
});

export const McpToolsetSchema = z.object({
  server: z.string(),
  tools: z.array(McpToolInfoSchema)
});

export const ServerStatsSchema = z.object({
  name: z.string(),
  status: z.enum(["online", "degraded", "offline"]),
  heartbeatAt: z.number(),
  requestsPerMinute: z.number(),
  averageLatencyMs: z.number(),
  p95LatencyMs: z.number(),
  errorRate: z.number(),
  throughput: z.number(),
  inFlight: z.number()
});

export const TraceHopSchema = z.object({
  source: z.string(),
  target: z.string().nullable(),
  latencyMs: z.number(),
  status: EventStatusSchema,
  timestamp: z.number(),
  errorMessage: z.string().nullable(),
  eventType: EventTypeSchema
});

export const TraceSummarySchema = z.object({
  traceId: z.string(),
  requestId: z.string(),
  origin: z.string(),
  path: z.array(z.string()),
  totalLatencyMs: z.number(),
  status: z.enum(["running", "success", "failed"]),
  startedAt: z.number(),
  updatedAt: z.number(),
  hops: z.array(TraceHopSchema)
});

export const DependencyEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  volume: z.number(),
  averageLatencyMs: z.number()
});

export const AlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  kind: z.enum(["latency", "failure", "loop", "routing"]),
  title: z.string(),
  detail: z.string(),
  server: z.string().nullable(),
  timestamp: z.number()
});

export const OverviewStatsSchema = z.object({
  totalServers: z.number(),
  activeServers: z.number(),
  requestsLastMinute: z.number(),
  averageLatencyMs: z.number(),
  failedRequests: z.number(),
  anomalyCount: z.number()
});

export const TimeseriesPointSchema = z.object({
  timestamp: z.number(),
  requests: z.number(),
  failures: z.number(),
  averageLatencyMs: z.number()
});

export const DashboardSnapshotSchema = z.object({
  generatedAt: z.number(),
  overview: OverviewStatsSchema,
  servers: z.array(ServerStatsSchema),
  toolsets: z.array(McpToolsetSchema),
  traces: z.array(TraceSummarySchema),
  dependencies: z.array(DependencyEdgeSchema),
  alerts: z.array(AlertSchema),
  timeseries: z.array(TimeseriesPointSchema)
});

export const McpRegistryRecordSchema = z.object({
  slug: z.string(),
  name: z.string(),
  transport: z.string(),
  status: z.enum(["online", "degraded", "offline", "configured"]),
  tools: z.array(McpToolInfoSchema),
  url: z.string().nullable().optional()
});

export const TelemetryEventSchema = z.object({
  eventId: z.string(),
  traceId: z.string(),
  requestId: z.string(),
  timestamp: z.number(),
  sourceMcp: McpNameSchema,
  targetMcp: McpNameSchema.nullable(),
  eventType: EventTypeSchema,
  status: EventStatusSchema,
  latencyMs: z.number(),
  errorMessage: z.string().nullable()
});

export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type McpRegistryRecord = z.infer<typeof McpRegistryRecordSchema>;
export type McpToolInfo = z.infer<typeof McpToolInfoSchema>;
export type TraceSummary = z.infer<typeof TraceSummarySchema>;
export type Alert = z.infer<typeof AlertSchema>;
```

Create `packages/contracts/src/index.ts`:

```ts
export * from "./dashboard.js";
```

- [ ] **Step 5: Add the new workspace and root test scripts**

Replace the root `package.json` with:

```json
{
  "name": "mcp-atlas",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "apps/server",
    "apps/web",
    "packages/contracts",
    "services/search-mcp",
    "services/memory-mcp",
    "services/file-mcp"
  ],
  "scripts": {
    "dev": "npm-run-all --parallel dev:search dev:memory dev:file dev:server dev:web",
    "dev:search": "npm run dev -w @mcp-atlas/search-mcp",
    "dev:memory": "npm run dev -w @mcp-atlas/memory-mcp",
    "dev:file": "npm run dev -w @mcp-atlas/file-mcp",
    "dev:server": "npm run dev -w @mcp-atlas/server",
    "dev:web": "npm run dev -w @mcp-atlas/web",
    "build": "npm run build -w @mcp-atlas/contracts && npm run build -w @mcp-atlas/search-mcp && npm run build -w @mcp-atlas/memory-mcp && npm run build -w @mcp-atlas/file-mcp && npm run build -w @mcp-atlas/server && npm run build -w @mcp-atlas/web",
    "test": "npm run test -w @mcp-atlas/contracts"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5"
  }
}
```

- [ ] **Step 6: Run the contracts test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/contracts
```

Expected: PASS with 3 passing assertions.

- [ ] **Step 7: Commit**

```bash
git add package.json packages/contracts
git commit -m "feat: add shared contracts package"
```

### Task 2: Rename The Backend Workspace And Extract The API App Shell

**Files:**
- Move: `apps/server` -> `apps/api`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/app/create-app.ts`
- Create: `apps/api/src/app/runtime.ts`
- Create: `apps/api/src/routes/registry-routes.ts`
- Create: `apps/api/src/routes/registry-routes.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Rename the workspace and update package metadata**

Run:

```bash
git mv apps/server apps/api
```

Replace `apps/api/package.json` with:

```json
{
  "name": "@mcp-atlas/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@blaxel/core": "^0.2.0",
    "@mcp-atlas/contracts": "^0.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^4.21.2",
    "socket.io": "^4.8.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.13.10",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^3.1.1"
  }
}
```

Update the root `package.json` workspace and scripts from `server` to `api`.

- [ ] **Step 2: Write the failing registry route test**

Create `apps/api/src/routes/registry-routes.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerRegistryRoutes } from "./registry-routes.js";

describe("registerRegistryRoutes", () => {
  it("returns normalized MCP registry records", async () => {
    const app = express();

    registerRegistryRoutes(app, {
      listMcps: async () => [
        {
          slug: "search-mcp",
          name: "Search MCP",
          transport: "http",
          status: "online",
          tools: [],
          url: "http://localhost:4001"
        }
      ]
    });

    const response = await request(app).get("/api/registry/mcps");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: "search-mcp",
        name: "Search MCP",
        transport: "http",
        status: "online",
        tools: [],
        url: "http://localhost:4001"
      }
    ]);
  });
});
```

- [ ] **Step 3: Run the API route test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/api -- registry-routes.test.ts
```

Expected: FAIL with `Cannot find module './registry-routes.js'`.

- [ ] **Step 4: Implement the minimal API app shell and registry route**

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

Create `apps/api/src/app/runtime.ts`:

```ts
import { TelemetryStore } from "../store.js";

export interface ApiRuntime {
  store: TelemetryStore;
  registryService: {
    listMcps(): Promise<unknown[]>;
  };
}

export function createRuntime(registryService: ApiRuntime["registryService"]): ApiRuntime {
  return {
    store: new TelemetryStore(),
    registryService
  };
}
```

Create `apps/api/src/routes/registry-routes.ts`:

```ts
import type { Express } from "express";

export function registerRegistryRoutes(
  app: Express,
  registryService: { listMcps(): Promise<unknown[]> }
) {
  app.get("/api/registry/mcps", async (_req, res) => {
    const records = await registryService.listMcps();
    res.json(records);
  });
}
```

Create `apps/api/src/app/create-app.ts`:

```ts
import cors from "cors";
import express from "express";
import { registerRegistryRoutes } from "../routes/registry-routes.js";
import type { ApiRuntime } from "./runtime.js";

export function createApp(runtime: ApiRuntime) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  registerRegistryRoutes(app, runtime.registryService);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
```

Replace `apps/api/src/index.ts` with:

```ts
import dotenv from "dotenv";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createApp } from "./app/create-app.js";
import { createRuntime } from "./app/runtime.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

const port = Number(process.env.PORT ?? 4000);

const runtime = createRuntime({
  async listMcps() {
    return [];
  }
});

const app = createApp(runtime);
const httpServer = createServer(app);

new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

httpServer.listen(port, () => {
  console.log(`MCP Atlas API running on http://localhost:${port}`);
});
```

- [ ] **Step 5: Run the API route test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/api -- registry-routes.test.ts
```

Expected: PASS with one passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json apps/api
git commit -m "refactor: rename server workspace and add api shell"
```

### Task 3: Extract Telemetry, Snapshot, Trace, Topology, And Anomaly Modules

**Files:**
- Create: `apps/api/src/modules/telemetry/telemetry-service.test.ts`
- Create: `apps/api/src/modules/telemetry/telemetry-service.ts`
- Create: `apps/api/src/modules/topology/topology-service.ts`
- Create: `apps/api/src/modules/anomalies/anomalies-service.ts`
- Create: `apps/api/src/modules/logs/trace-query-service.ts`
- Create: `apps/api/src/routes/snapshot-routes.ts`
- Modify: `apps/api/src/app/create-app.ts`
- Modify: `apps/api/src/app/runtime.ts`
- Modify: `apps/api/src/store.ts`

- [ ] **Step 1: Write the failing telemetry service test**

Create `apps/api/src/modules/telemetry/telemetry-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TelemetryService } from "./telemetry-service.js";

describe("TelemetryService", () => {
  it("builds a dashboard snapshot from ingested events", () => {
    const telemetry = new TelemetryService();

    telemetry.ingest({
      eventId: "evt-1",
      traceId: "trace-1",
      requestId: "req-1",
      timestamp: Date.now(),
      sourceMcp: "Gateway MCP",
      targetMcp: "Search MCP",
      eventType: "REQUEST_FORWARDED",
      status: "ok",
      latencyMs: 120,
      errorMessage: null
    });

    const snapshot = telemetry.snapshot();

    expect(snapshot.dependencies).toEqual([
      expect.objectContaining({
        source: "Gateway MCP",
        target: "Search MCP",
        volume: 1
      })
    ]);
  });
});
```

- [ ] **Step 2: Run the telemetry service test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/api -- telemetry-service.test.ts
```

Expected: FAIL with `Cannot find module './telemetry-service.js'`.

- [ ] **Step 3: Implement the extracted telemetry modules**

Create `apps/api/src/modules/telemetry/telemetry-service.ts`:

```ts
import type { DashboardSnapshot, TelemetryEvent } from "@mcp-atlas/contracts";
import { TelemetryStore } from "../../store.js";

export class TelemetryService {
  private readonly store = new TelemetryStore();

  ingest(event: TelemetryEvent) {
    this.store.ingest(event);
  }

  snapshot(): DashboardSnapshot {
    return this.store.snapshot();
  }
}
```

Create `apps/api/src/modules/topology/topology-service.ts`:

```ts
import type { DashboardSnapshot } from "@mcp-atlas/contracts";

export class TopologyService {
  fromSnapshot(snapshot: DashboardSnapshot) {
    return {
      nodes: snapshot.servers.map((server) => ({
        id: server.name,
        status: server.status
      })),
      edges: snapshot.dependencies,
      toolsets: snapshot.toolsets
    };
  }
}
```

Create `apps/api/src/modules/anomalies/anomalies-service.ts`:

```ts
import type { Alert, DashboardSnapshot } from "@mcp-atlas/contracts";

export class AnomaliesService {
  list(snapshot: DashboardSnapshot): Alert[] {
    return snapshot.alerts;
  }
}
```

Create `apps/api/src/modules/logs/trace-query-service.ts`:

```ts
import type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";

export class TraceQueryService {
  list(snapshot: DashboardSnapshot): TraceSummary[] {
    return snapshot.traces;
  }

  getById(snapshot: DashboardSnapshot, traceId: string) {
    return snapshot.traces.find((trace) => trace.traceId === traceId) ?? null;
  }
}
```

Create `apps/api/src/routes/snapshot-routes.ts`:

```ts
import type { Express } from "express";
import type { AnomaliesService } from "../modules/anomalies/anomalies-service.js";
import type { TraceQueryService } from "../modules/logs/trace-query-service.js";
import type { TelemetryService } from "../modules/telemetry/telemetry-service.js";
import type { TopologyService } from "../modules/topology/topology-service.js";

export function registerSnapshotRoutes(
  app: Express,
  services: {
    telemetry: TelemetryService;
    topology: TopologyService;
    anomalies: AnomaliesService;
    traces: TraceQueryService;
  }
) {
  app.get("/api/snapshot", (_req, res) => {
    res.json(services.telemetry.snapshot());
  });

  app.get("/api/topology", (_req, res) => {
    res.json(services.topology.fromSnapshot(services.telemetry.snapshot()));
  });

  app.get("/api/anomalies", (_req, res) => {
    res.json(services.anomalies.list(services.telemetry.snapshot()));
  });

  app.get("/api/traces", (_req, res) => {
    res.json(services.traces.list(services.telemetry.snapshot()));
  });

  app.get("/api/traces/:traceId", (req, res) => {
    const trace = services.traces.getById(services.telemetry.snapshot(), req.params.traceId);
    if (!trace) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }
    res.json(trace);
  });
}
```

Wire these services through `apps/api/src/app/runtime.ts` and `apps/api/src/app/create-app.ts`.

- [ ] **Step 4: Run the telemetry service test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/api -- telemetry-service.test.ts
```

Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "refactor: extract telemetry and snapshot modules"
```

### Task 4: Introduce The MCP Adapter Interface And Local HTTP Adapters

**Files:**
- Create: `apps/api/src/adapters/types.ts`
- Create: `apps/api/src/adapters/local/local-http-mcp-adapter.ts`
- Create: `apps/api/src/adapters/local/local-http-mcp-adapter.test.ts`
- Create: `apps/api/src/modules/mcp-registry/mcp-registry-service.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/src/app/runtime.ts`
- Modify: `apps/api/src/routes/registry-routes.ts`

- [ ] **Step 1: Write the failing local adapter test**

Create `apps/api/src/adapters/local/local-http-mcp-adapter.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalHttpMcpAdapter } from "./local-http-mcp-adapter.js";

describe("LocalHttpMcpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the local MCP tool endpoint and returns JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tool: "search", results: ["one"] })
      })
    );

    const adapter = new LocalHttpMcpAdapter({
      slug: "search-mcp",
      name: "Search MCP",
      url: "http://localhost:4001",
      transport: "http",
      status: "online",
      tools: [
        { id: "search", name: "search", description: "Search", requestCount: 0, averageLatencyMs: 0 }
      ]
    });

    const result = await adapter.callTool("search", { query: "atlas" });

    expect(result).toEqual({ tool: "search", results: ["one"] });
  });
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/api -- local-http-mcp-adapter.test.ts
```

Expected: FAIL with `Cannot find module './local-http-mcp-adapter.js'`.

- [ ] **Step 3: Implement the adapter contract and local adapter**

Create `apps/api/src/adapters/types.ts`:

```ts
import type { McpRegistryRecord } from "@mcp-atlas/contracts";

export interface McpAdapter {
  describeServer(): McpRegistryRecord;
  listTools(): Promise<McpRegistryRecord["tools"]>;
  healthcheck(): Promise<"online" | "degraded" | "offline">;
  callTool(toolName: string, payload: Record<string, unknown>): Promise<unknown>;
}
```

Create `apps/api/src/adapters/local/local-http-mcp-adapter.ts`:

```ts
import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import type { McpAdapter } from "../types.js";

export class LocalHttpMcpAdapter implements McpAdapter {
  constructor(private readonly record: McpRegistryRecord & { url: string }) {}

  describeServer() {
    return this.record;
  }

  async listTools() {
    return this.record.tools;
  }

  async healthcheck() {
    const response = await fetch(`${this.record.url}/health`);
    return response.ok ? "online" : "degraded";
  }

  async callTool(toolName: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.record.url}/tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, toolName })
    });

    if (!response.ok) {
      throw new Error(`Local MCP call failed for ${toolName}`);
    }

    return response.json();
  }
}
```

Create `apps/api/src/modules/mcp-registry/mcp-registry-service.ts`:

```ts
import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import type { McpAdapter } from "../../adapters/types.js";

export class McpRegistryService {
  constructor(private readonly adapters: Map<string, McpAdapter>) {}

  async listMcps(): Promise<McpRegistryRecord[]> {
    return Array.from(this.adapters.values()).map((adapter) => adapter.describeServer());
  }

  getAdapter(slug: string) {
    return this.adapters.get(slug) ?? null;
  }
}
```

Modify `apps/api/src/services.ts` so each local service can be translated into a `McpRegistryRecord`.

- [ ] **Step 4: Run the adapter test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/api -- local-http-mcp-adapter.test.ts
```

Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: add adapter contract and local MCP adapters"
```

### Task 5: Route Agent Controls Through Adapters And Add The Blaxel Sandbox Adapter

**Files:**
- Create: `apps/api/src/adapters/blaxel/blaxel-sandbox-adapter.ts`
- Create: `apps/api/src/modules/controls/controls-service.ts`
- Create: `apps/api/src/modules/controls/controls-service.test.ts`
- Create: `apps/api/src/routes/control-routes.ts`
- Modify: `apps/api/src/blaxel-mcp.ts`
- Modify: `apps/api/src/app/runtime.ts`
- Modify: `apps/api/src/app/create-app.ts`

- [ ] **Step 1: Write the failing controls service test**

Create `apps/api/src/modules/controls/controls-service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ControlsService } from "./controls-service.js";

describe("ControlsService", () => {
  it("runs a Blaxel processes-list call through the adapter", async () => {
    const blaxelAdapter = {
      describeServer: () => ({ name: "Atlas Blaxel MCP" }),
      callTool: vi.fn().mockResolvedValue({ processes: [{ pid: 1 }] })
    };

    const service = new ControlsService({
      registry: {
        getAdapter(slug: string) {
          return slug === "atlas-blaxel-mcp" ? blaxelAdapter : null;
        }
      },
      telemetry: {
        ingest: vi.fn()
      }
    });

    const result = await service.callMcpTool("atlas-blaxel-mcp", "processesList", {});

    expect(result).toEqual({ processes: [{ pid: 1 }] });
    expect(blaxelAdapter.callTool).toHaveBeenCalledWith("processesList", {});
  });
});
```

- [ ] **Step 2: Run the controls service test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/api -- controls-service.test.ts
```

Expected: FAIL with `Cannot find module './controls-service.js'`.

- [ ] **Step 3: Implement the Blaxel adapter and controls service**

Create `apps/api/src/adapters/blaxel/blaxel-sandbox-adapter.ts`:

```ts
import type { McpRegistryRecord } from "@mcp-atlas/contracts";
import { BlaxelMcpService } from "../../blaxel-mcp.js";
import type { McpAdapter } from "../types.js";

export class BlaxelSandboxAdapter implements McpAdapter {
  constructor(
    private readonly record: McpRegistryRecord,
    private readonly client: BlaxelMcpService
  ) {}

  describeServer() {
    return this.record;
  }

  async listTools() {
    const response = await this.client.listTools();
    return response.tools.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description ?? null,
      requestCount: 0,
      averageLatencyMs: 0
    }));
  }

  async healthcheck() {
    await this.client.ping();
    return "online";
  }

  async callTool(toolName: string, payload: Record<string, unknown>) {
    return this.client.callTool(toolName, payload);
  }
}
```

Create `apps/api/src/modules/controls/controls-service.ts`:

```ts
import type { TelemetryEvent } from "@mcp-atlas/contracts";

export class ControlsService {
  constructor(
    private readonly deps: {
      registry: {
        getAdapter(slug: string): {
          describeServer(): { name: "Gateway MCP" | "Search MCP" | "Memory MCP" | "File MCP" | "Atlas Blaxel MCP" };
          callTool(name: string, payload: Record<string, unknown>): Promise<unknown>;
        } | null;
      };
      telemetry: { ingest(event: TelemetryEvent): void };
    }
  ) {}

  async callMcpTool(slug: string, toolName: string, payload: Record<string, unknown>) {
    const adapter = this.deps.registry.getAdapter(slug);
    if (!adapter) {
      throw new Error(`Unknown MCP adapter: ${slug}`);
    }

    const startedAt = Date.now();
    const targetName = adapter.describeServer().name;
    try {
      const result = await adapter.callTool(toolName, payload);
      this.deps.telemetry.ingest({
        eventId: `evt-${startedAt}`,
        traceId: `trace-${startedAt}`,
        requestId: `req-${startedAt}`,
        timestamp: startedAt,
        sourceMcp: "Gateway MCP",
        targetMcp: targetName,
        eventType: "REQUEST_COMPLETED",
        status: "ok",
        latencyMs: Date.now() - startedAt,
        errorMessage: null
      });
      return result;
    } catch (error) {
      this.deps.telemetry.ingest({
        eventId: `evt-${startedAt}`,
        traceId: `trace-${startedAt}`,
        requestId: `req-${startedAt}`,
        timestamp: startedAt,
        sourceMcp: "Gateway MCP",
        targetMcp: targetName,
        eventType: "REQUEST_FAILED",
        status: "error",
        latencyMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown MCP error"
      });
      throw error;
    }
  }
}
```

Create `apps/api/src/routes/control-routes.ts` with:

```ts
import type { Express } from "express";
import type { ControlsService } from "../modules/controls/controls-service.js";

export function registerControlRoutes(app: Express, controls: ControlsService) {
  app.post("/api/controls/mcps/:mcpSlug/tools/:toolId", async (req, res) => {
    const result = await controls.callMcpTool(req.params.mcpSlug, req.params.toolId, req.body ?? {});
    res.json(result);
  });
}
```

Extend this module with `POST /api/controls/agent-task`, `POST /api/controls/failure`, and `POST /api/controls/blaxel/processes-list` by mapping them through adapters instead of direct inline calls.

- [ ] **Step 4: Run the controls service test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/api -- controls-service.test.ts
```

Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: route controls through local and blaxel adapters"
```

### Task 6: Add Frontend Test Tooling, Typed API Client, And Page Shells

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/App.test.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/pages/OverviewPage.tsx`
- Create: `apps/web/src/pages/TopologyPage.tsx`
- Create: `apps/web/src/pages/LogsPage.tsx`
- Create: `apps/web/src/pages/HealthPage.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Add frontend test tooling**

Replace `apps/web/package.json` with:

```json
{
  "name": "@mcp-atlas/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@mcp-atlas/contracts": "^0.1.0",
    "cytoscape": "^3.31.2",
    "react": "^19.0.0",
    "react-cytoscapejs": "^2.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.6.3",
    "recharts": "^2.15.1",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.2",
    "vite": "^6.2.1",
    "vitest": "^3.1.1"
  }
}
```

Create `apps/web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write the failing app shell test**

Create `apps/web/src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

describe("App", () => {
  it("renders dashboard navigation links", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /topology/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /health/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the app shell test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/web -- App.test.tsx
```

Expected: FAIL with `Cannot find module './App'`.

- [ ] **Step 4: Implement the app shell, router, and typed API client**

Create `apps/web/src/api/client.ts`:

```ts
import type { DashboardSnapshot, TraceSummary } from "@mcp-atlas/contracts";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

export const apiClient = {
  getSnapshot() {
    return fetch(`${apiBase}/api/snapshot`).then(readJson<DashboardSnapshot>);
  },
  getTraces() {
    return fetch(`${apiBase}/api/traces`).then(readJson<TraceSummary[]>);
  },
  triggerAgentTask() {
    return fetch(`${apiBase}/api/controls/agent-task`, { method: "POST" }).then(readJson<unknown>);
  }
};
```

Create `apps/web/src/app/App.tsx`:

```tsx
import { NavLink, Outlet } from "react-router-dom";

export function App() {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1>MCP Atlas</h1>
        <nav className="shell__nav">
          <NavLink to="/">Overview</NavLink>
          <NavLink to="/topology">Topology</NavLink>
          <NavLink to="/logs">Logs</NavLink>
          <NavLink to="/health">Health</NavLink>
        </nav>
      </header>
      <main className="shell__content">
        <Outlet />
      </main>
    </div>
  );
}
```

Create `apps/web/src/app/router.tsx`:

```tsx
import { createHashRouter } from "react-router-dom";
import { App } from "./App";
import { HealthPage } from "../pages/HealthPage";
import { LogsPage } from "../pages/LogsPage";
import { OverviewPage } from "../pages/OverviewPage";
import { TopologyPage } from "../pages/TopologyPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "topology", element: <TopologyPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "health", element: <HealthPage /> }
    ]
  }
]);
```

Create simple page shells that return headings:

```tsx
export function OverviewPage() {
  return <section><h2>Overview</h2></section>;
}
```

Repeat the same pattern for `TopologyPage`, `LogsPage`, and `HealthPage`.

Replace `apps/web/src/main.tsx` with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

- [ ] **Step 5: Run the app shell test to verify it passes**

Run:

```bash
npm run test -w @mcp-atlas/web -- App.test.tsx
```

Expected: PASS with one passing test.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor: add frontend app shell and typed client"
```

### Task 7: Extract Dashboard Features And Move Topology, Logs, Controls, And Registry Out Of `App.tsx`

**Files:**
- Create: `apps/web/src/features/topology/build-topology-elements.ts`
- Create: `apps/web/src/features/topology/build-topology-elements.test.ts`
- Create: `apps/web/src/features/topology/TopologyGraph.tsx`
- Create: `apps/web/src/features/logs/export-trace-csv.ts`
- Create: `apps/web/src/features/logs/export-trace-csv.test.ts`
- Create: `apps/web/src/features/logs/TraceList.tsx`
- Create: `apps/web/src/features/logs/TraceDetail.tsx`
- Create: `apps/web/src/features/controls/LiveTrafficControls.tsx`
- Create: `apps/web/src/features/registry/McpRegistryPanel.tsx`
- Create: `apps/web/src/features/overview/OverviewCards.tsx`
- Create: `apps/web/src/features/health/HealthGrid.tsx`
- Modify: `apps/web/src/pages/OverviewPage.tsx`
- Modify: `apps/web/src/pages/TopologyPage.tsx`
- Modify: `apps/web/src/pages/LogsPage.tsx`
- Modify: `apps/web/src/pages/HealthPage.tsx`

- [ ] **Step 1: Write the failing topology builder test**

Create `apps/web/src/features/topology/build-topology-elements.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTopologyElements } from "./build-topology-elements";

describe("buildTopologyElements", () => {
  it("creates tool nodes attached to MCP nodes", () => {
    const elements = buildTopologyElements({
      generatedAt: Date.now(),
      overview: {
        totalServers: 1,
        activeServers: 1,
        requestsLastMinute: 1,
        averageLatencyMs: 100,
        failedRequests: 0,
        anomalyCount: 0
      },
      servers: [
        {
          name: "Search MCP",
          status: "online",
          heartbeatAt: Date.now(),
          requestsPerMinute: 1,
          averageLatencyMs: 100,
          p95LatencyMs: 100,
          errorRate: 0,
          throughput: 1,
          inFlight: 0
        }
      ],
      toolsets: [
        {
          server: "Search MCP",
          tools: [
            {
              id: "search",
              name: "search",
              description: "Search",
              requestCount: 3,
              averageLatencyMs: 90
            }
          ]
        }
      ],
      traces: [],
      dependencies: [],
      alerts: [],
      timeseries: []
    });

    expect(elements.some((element) => element.data.id === "Search MCP::search")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the topology builder test to verify it fails**

Run:

```bash
npm run test -w @mcp-atlas/web -- build-topology-elements.test.ts
```

Expected: FAIL with `Cannot find module './build-topology-elements'`.

- [ ] **Step 3: Implement feature extraction**

Create `apps/web/src/features/topology/build-topology-elements.ts`:

```ts
import type { DashboardSnapshot } from "@mcp-atlas/contracts";

export function buildTopologyElements(snapshot: DashboardSnapshot) {
  const mcpNodes = snapshot.servers.map((server) => ({
    data: {
      id: server.name,
      label: server.name,
      kind: "mcp",
      status: server.status
    }
  }));

  const toolNodes = snapshot.toolsets.flatMap((toolset) =>
    toolset.tools.map((tool) => ({
      data: {
        id: `${toolset.server}::${tool.id}`,
        label: tool.name,
        kind: "tool",
        parent: toolset.server
      }
    }))
  );

  const mcpEdges = snapshot.dependencies.map((edge) => ({
    data: {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: `${edge.volume} req`
    }
  }));

  const toolEdges = snapshot.toolsets.flatMap((toolset) =>
    toolset.tools.map((tool) => ({
      data: {
        id: `${toolset.server}::${tool.id}::edge`,
        source: `${toolset.server}::${tool.id}`,
        target: toolset.server,
        label: `${tool.requestCount} req`
      },
      classes: "tool-edge"
    }))
  );

  return [...mcpNodes, ...toolNodes, ...mcpEdges, ...toolEdges];
}
```

Create `apps/web/src/features/logs/export-trace-csv.ts`:

```ts
import type { TraceSummary } from "@mcp-atlas/contracts";

export function exportTraceCsv(trace: TraceSummary) {
  const header = [
    "traceId",
    "requestId",
    "source",
    "target",
    "status",
    "latencyMs",
    "timestamp"
  ];

  const rows = trace.hops.map((hop) => [
    trace.traceId,
    trace.requestId,
    hop.source,
    hop.target ?? "",
    hop.status,
    String(hop.latencyMs),
    String(hop.timestamp)
  ]);

  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
```

Create `apps/web/src/features/logs/export-trace-csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exportTraceCsv } from "./export-trace-csv";

describe("exportTraceCsv", () => {
  it("serializes trace hops into CSV rows", () => {
    const csv = exportTraceCsv({
      traceId: "trace-1",
      requestId: "req-1",
      origin: "Gateway MCP",
      path: ["Gateway MCP", "Search MCP"],
      totalLatencyMs: 120,
      status: "success",
      startedAt: 1,
      updatedAt: 2,
      hops: [
        {
          source: "Gateway MCP",
          target: "Search MCP",
          latencyMs: 120,
          status: "ok",
          timestamp: 1,
          errorMessage: null,
          eventType: "REQUEST_COMPLETED"
        }
      ]
    });

    expect(csv).toContain("traceId,requestId,source,target,status,latencyMs,timestamp");
    expect(csv).toContain("trace-1,req-1,Gateway MCP,Search MCP,ok,120,1");
  });
});
```

Create feature components and have the page files assemble them:

- `OverviewPage` should render `OverviewCards`, `LiveTrafficControls`, and `McpRegistryPanel`
- `TopologyPage` should render `TopologyGraph`
- `LogsPage` should render `TraceList` and `TraceDetail`
- `HealthPage` should render `HealthGrid`

- [ ] **Step 4: Run the topology and CSV tests to verify they pass**

Run:

```bash
npm run test -w @mcp-atlas/web -- build-topology-elements.test.ts export-trace-csv.test.ts
```

Expected: PASS with two passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "refactor: extract dashboard features from frontend app"
```

### Task 8: Clean Build Artifacts, Normalize Scripts, And Run Full Verification

**Files:**
- Modify: `package.json`
- Modify: `apps/web/tsconfig.json`
- Delete: `apps/web/src/App.js`
- Delete: `apps/web/src/main.js`
- Delete: `apps/web/src/types.js`

- [ ] **Step 1: Stop emitting JavaScript into the frontend source tree**

Replace `apps/web/tsconfig.json` with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src"]
}
```

Update the root `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:search dev:memory dev:file dev:api dev:web",
    "dev:search": "npm run dev -w @mcp-atlas/search-mcp",
    "dev:memory": "npm run dev -w @mcp-atlas/memory-mcp",
    "dev:file": "npm run dev -w @mcp-atlas/file-mcp",
    "dev:api": "npm run dev -w @mcp-atlas/api",
    "dev:web": "npm run dev -w @mcp-atlas/web",
    "build": "npm run build -w @mcp-atlas/contracts && npm run build -w @mcp-atlas/search-mcp && npm run build -w @mcp-atlas/memory-mcp && npm run build -w @mcp-atlas/file-mcp && npm run build -w @mcp-atlas/api && npm run build -w @mcp-atlas/web",
    "test": "npm run test -w @mcp-atlas/contracts && npm run test -w @mcp-atlas/api && npm run test -w @mcp-atlas/web"
  }
}
```

- [ ] **Step 2: Remove generated source artifacts**

Run:

```bash
Remove-Item 'apps/web/src/App.js','apps/web/src/main.js','apps/web/src/types.js'
```

If additional generated JavaScript files appear in `apps/web/src`, delete them in the same commit.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm install
npm run test
npm run build
```

Expected:
- all workspace tests PASS
- all workspace builds PASS
- `git status --short` does not show regenerated frontend JS artifacts

- [ ] **Step 4: Commit**

```bash
git add package.json apps/web/tsconfig.json apps/web/src
git commit -m "chore: finalize modular app structure and build cleanup"
```

- [ ] **Step 5: Push the refactor branch**

```bash
git push origin main
```
