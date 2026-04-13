import { useState } from "react";
import { AlertList, TopologyGraph } from "../app/dashboard-shared";
import { useDashboardAppContext } from "../app/App";

export function TopologyPage() {
  const { snapshot, graphElements } = useDashboardAppContext();
  const [showClusters, setShowClusters] = useState(false);

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="empty">Loading topology data...</p>
        </article>
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-header panel-header-stack">
          <div>
            <h2>MCP Topology Graph</h2>
            <p>Directed edges stay readable, cluster mode groups servers by role, and tool leaf nodes show exposed capabilities.</p>
          </div>
          <button
            type="button"
            className={`view-toggle ${showClusters ? "view-toggle-active" : ""}`}
            onClick={() => setShowClusters((current) => !current)}
          >
            Clusters
          </button>
        </div>
        <TopologyGraph
          topologyElements={showClusters ? graphElements.clustered : graphElements.flat}
          tall
          clustered={showClusters}
        />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Dependency Edges</h2>
            <p>Most active connections in the last minute.</p>
          </div>
        </div>
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

      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <h2>Alignment Insights</h2>
            <p>Network-level anomalies surfaced from dependency and trace patterns.</p>
          </div>
        </div>
        <AlertList alerts={snapshot.alerts} />
      </article>
    </section>
  );
}
