import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";
import { io } from "socket.io-client";
import { apiBase, apiClient } from "../api/client";
import type { BlaxelFunctionRecord, BlaxelToolRecord, DashboardSnapshot, TraceSummary } from "../types";
import {
  MetricCard,
  buildTopologyElements,
  formatTime,
  type GraphElementsBundle,
} from "./dashboard-shared";

const socket = io(apiBase || undefined, {
  autoConnect: false,
});

type ActionState = {
  pending: boolean;
  message: string | null;
};

export type DashboardAppContextValue = {
  snapshot: DashboardSnapshot;
  selectedTrace: TraceSummary | null;
  selectedTraceId: string | null;
  setSelectedTraceId: (traceId: string | null) => void;
  graphElements: GraphElementsBundle;
  blaxelFunctions: BlaxelFunctionRecord[];
  functionTestState: Record<string, string>;
  functionTools: Record<string, BlaxelToolRecord[]>;
  functionToolState: Record<string, string>;
  onTestFunction: (functionName: string) => Promise<void>;
  onLoadTools: (functionName: string) => Promise<void>;
  actionPending: boolean;
  actionMessage: string | null;
  onRunAgentTask: () => Promise<void>;
  onRunSearch: () => Promise<void>;
  onRunFailure: () => Promise<void>;
  onRunBlaxelTask: () => Promise<void>;
};

export function useDashboardAppContext() {
  return useOutletContext<DashboardAppContextValue>();
}

export const useDashboardContext = useDashboardAppContext;

async function runApiAction(
  request: () => Promise<{ ok: boolean; data: { traceId?: string; error?: string } }>,
  successLabel: string,
  setActionState: Dispatch<SetStateAction<ActionState>>,
) {
  setActionState({ pending: true, message: null });

  try {
    const response = await request();
    if (!response.ok) {
      throw new Error(response.data.error ?? "Request failed");
    }

    setActionState({
      pending: false,
      message: response.data.traceId ? `${successLabel} trace: ${response.data.traceId}` : successLabel,
    });
  } catch (error) {
    setActionState({
      pending: false,
      message: error instanceof Error ? error.message : "Request failed",
    });
  }
}

type AppShellProps = {
  generatedAt?: number | null;
  overview?: DashboardSnapshot["overview"] | null;
  actionBar?: ReactNode;
  children?: ReactNode;
};

export function App({
  generatedAt = null,
  overview = null,
  actionBar = null,
  children = null,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Observability & Alignment Dashboard</p>
          <h1>MCP Atlas</h1>
          <p className="hero-copy">
            Real-time view of request paths, MCP dependencies, server health, and risky routing patterns.
          </p>
        </div>
        <div className="hero-meta">
          <span className="live-dot" />
          <span>{generatedAt ? `Live snapshot ${formatTime(generatedAt)}` : "Loading live snapshot..."}</span>
        </div>
      </header>

      <nav className="nav-bar" aria-label="Primary navigation">
        <NavItem to="/" label="Overview" />
        <NavItem to="/topology" label="Topology" />
        <NavItem to="/health" label="Health" />
        <NavItem to="/logs" label="Logs" />
      </nav>

      <section className="metric-grid" aria-label="Dashboard summary">
        <MetricCard label="Active Servers" value={overview ? `${overview.activeServers}/${overview.totalServers}` : "-"} />
        <MetricCard label="Requests / Min" value={overview ? String(overview.requestsLastMinute) : "-"} />
        <MetricCard label="Avg Latency" value={overview ? `${overview.averageLatencyMs}ms` : "-"} />
        <MetricCard label="Anomalies" value={overview ? String(overview.anomalyCount) : "-"} />
      </section>

      {actionBar}
      <main>{children}</main>
    </div>
  );
}

export function DashboardApp() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [blaxelFunctions, setBlaxelFunctions] = useState<BlaxelFunctionRecord[]>([]);
  const [functionTestState, setFunctionTestState] = useState<Record<string, string>>({});
  const [functionTools, setFunctionTools] = useState<Record<string, BlaxelToolRecord[]>>({});
  const [functionToolState, setFunctionToolState] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<ActionState>({
    pending: false,
    message: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      const snapshotPayload = await apiClient.getSnapshot();

      if (cancelled) {
        return;
      }

      setSnapshot(snapshotPayload);
      setSelectedTraceId((current) => current ?? snapshotPayload.traces[0]?.traceId ?? null);
    }

    async function loadBlaxelFunctions() {
      const functionsPayload = await apiClient.getBlaxelFunctions();

      if (cancelled) {
        return;
      }

      if (functionsPayload.ok && functionsPayload.functions) {
        setBlaxelFunctions(functionsPayload.functions);
      }
    }

    loadSnapshot().catch((error) => console.error("Failed to load snapshot", error));
    loadBlaxelFunctions().catch((error) => console.error("Failed to load Blaxel functions", error));

    socket.connect();
    socket.on("dashboard:snapshot", (nextSnapshot: DashboardSnapshot) => {
      if (cancelled) {
        return;
      }

      setSnapshot(nextSnapshot);
      setSelectedTraceId((current) => {
        if (current && nextSnapshot.traces.some((trace) => trace.traceId === current)) {
          return current;
        }
        return nextSnapshot.traces[0]?.traceId ?? null;
      });
    });

    return () => {
      cancelled = true;
      socket.off("dashboard:snapshot");
      socket.disconnect();
    };
  }, []);

  const graphElements = useMemo(() => {
    if (!snapshot) {
      return { flat: [], clustered: [] };
    }
    return buildTopologyElements(snapshot);
  }, [snapshot]);

  const selectedTrace = snapshot?.traces.find((trace) => trace.traceId === selectedTraceId) ?? null;

  async function testBlaxelFunction(functionName: string) {
    setFunctionTestState((current) => ({ ...current, [functionName]: "Testing..." }));

    try {
      const payload = await apiClient.testBlaxelFunction(functionName);
      if (!payload.ok) {
        throw new Error(payload.error ?? "Function test failed");
      }

      setFunctionTestState((current) => ({
        ...current,
        [functionName]: `${payload.toolCount ?? 0} tools reachable`,
      }));
    } catch (error) {
      setFunctionTestState((current) => ({
        ...current,
        [functionName]: error instanceof Error ? error.message : "Function test failed",
      }));
    }
  }

  async function loadBlaxelTools(functionName: string) {
    setFunctionToolState((current) => ({ ...current, [functionName]: "Loading tools..." }));

    try {
      const payload = await apiClient.getBlaxelTools(functionName);
      if (!payload.ok) {
        throw new Error(payload.error ?? "Tool discovery failed");
      }

      setFunctionTools((current) => ({ ...current, [functionName]: payload.tools ?? [] }));
      setFunctionToolState((current) => ({
        ...current,
        [functionName]: payload.tools?.length ? `${payload.tools.length} tools loaded` : "No tools exposed",
      }));
    } catch (error) {
      setFunctionToolState((current) => ({
        ...current,
        [functionName]: error instanceof Error ? error.message : "Tool discovery failed",
      }));
    }
  }

  return (
    <App
      generatedAt={snapshot?.generatedAt ?? null}
      overview={snapshot?.overview ?? null}
    >
      {snapshot ? (
        <Outlet
          context={{
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
            onRunFailure: () =>
              runApiAction(() => apiClient.triggerFailure(), "Failure scenario triggered", setActionState),
            onRunBlaxelTask: () =>
              runApiAction(
                () => apiClient.triggerBlaxelProcessesList(),
                "Blaxel sandbox MCP trace completed",
                setActionState,
              ),
          } satisfies DashboardAppContextValue}
        />
      ) : null}
    </App>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
      {label}
    </NavLink>
  );
}

export default DashboardApp;
