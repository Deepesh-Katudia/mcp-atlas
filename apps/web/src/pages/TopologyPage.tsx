import { useState } from "react";
import { useDashboardAppContext } from "../app/App";
import { PageHeader } from "../app/PageHeader";
import { MasonryWorkspace } from "../components/MasonryWorkspace";
import { AlertList } from "../features/overview/OverviewCards";
import { TopologyGraph } from "../features/topology/TopologyGraph";

export function TopologyPage() {
  const { snapshot, graphElements } = useDashboardAppContext();
  const [showClusters, setShowClusters] = useState(false);
  const [graphResizeSignal, setGraphResizeSignal] = useState(0);

  if (!snapshot) {
    return (
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="empty">Loading topology data...</p>
        </article>
      </section>
    );
  }

  const graphContent = (
    <>
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
          resizeSignal={graphResizeSignal}
          className="topology-graph-frame"
        />
      </div>
    </>
  );

  const edgesContent = (
    <>
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
    </>
  );

  const insightsContent = (
    <>
      <div className="panel-header">
        <div>
          <h2>Alignment Insights</h2>
          <p>Network-level anomalies surfaced from dependency and trace patterns.</p>
        </div>
      </div>
      <AlertList alerts={snapshot.alerts} />
    </>
  );

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

      <MasonryWorkspace
        workspaceId="topology"
        className="topology-layout"
        items={[
          {
            id: "topology-graph",
            label: "topology graph panel",
            className: "panel summary-panel-dark topology-graph-panel",
            as: "article",
            defaultSize: { width: 980, height: 760 },
            minSize: { width: 620, height: 460 },
            maxSize: { width: 1800, height: 1200 },
            onResizeEnd: () => setGraphResizeSignal((value) => value + 1),
            content: graphContent,
          },
          {
            id: "topology-edges",
            label: "dependency edges",
            className: "panel topology-support-panel",
            as: "article",
            defaultSize: { width: 360, height: 340 },
            minSize: { width: 320, height: 260 },
            maxSize: { width: 1200, height: 900 },
            content: edgesContent,
          },
          {
            id: "topology-insights",
            label: "alignment insights",
            className: "panel topology-support-panel",
            as: "article",
            defaultSize: { width: 360, height: 340 },
            minSize: { width: 320, height: 260 },
            maxSize: { width: 1200, height: 900 },
            content: insightsContent,
          },
        ]}
      />
    </>
  );
}
