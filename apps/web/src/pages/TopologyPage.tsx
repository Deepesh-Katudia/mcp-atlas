import { useState } from "react";
import { useDashboardAppContext } from "../app/App";
import { PageHeader } from "../app/PageHeader";
import { AlertList } from "../features/overview/OverviewCards";
import { TopologyGraph } from "../features/topology/TopologyGraph";

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

      <section className="dashboard-grid topology-layout">
        <article className="panel panel-wide summary-panel-dark topology-graph-panel">
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
              className="topology-graph-frame"
            />
          </div>
        </article>

        <div className="topology-support-column">
          <article className="panel topology-support-panel">
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

          <article className="panel topology-support-panel">
            <div className="panel-header">
              <div>
                <h2>Alignment Insights</h2>
                <p>Network-level anomalies surfaced from dependency and trace patterns.</p>
              </div>
            </div>
            <AlertList alerts={snapshot.alerts} />
          </article>
        </div>
      </section>
    </>
  );
}
