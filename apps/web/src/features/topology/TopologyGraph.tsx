import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { GraphElement } from "./build-topology-elements";

export function TopologyGraph({
  topologyElements,
  tall = false,
  clustered = false,
}: {
  topologyElements: GraphElement[];
  tall?: boolean;
  clustered?: boolean;
}) {
  const cyRef = useRef<any>(null);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    if (clustered) {
      cy.nodes().forEach((node: any) => {
        const clusterX = node.data("clusterX");
        const clusterY = node.data("clusterY");
        if (typeof clusterX === "number" && typeof clusterY === "number") {
          node.animate(
            {
              position: { x: clusterX, y: clusterY },
            },
            {
              duration: 560,
              easing: "ease-in-out-cubic",
            },
          );
        }
      });

      const fitTimer = window.setTimeout(() => {
        cy.fit(cy.elements(), 54);
      }, 580);

      return () => window.clearTimeout(fitTimer);
    }

    cy.layout({
      name: "breadthfirst",
      directed: true,
      roots: ["Gateway MCP"],
      spacingFactor: 1.28,
      padding: 30,
      animate: true,
      animationDuration: 560,
      fit: true,
    }).run();
  }, [clustered, topologyElements]);

  return (
    <div className={`graph-wrap ${tall ? "graph-wrap-tall" : ""}`}>
      <CytoscapeComponent
        className="graph-canvas"
        elements={topologyElements}
        style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
        layout={
          clustered
            ? {
                name: "preset",
                padding: 24,
              }
            : {
                name: "breadthfirst",
                directed: true,
                roots: ["Gateway MCP"],
                spacingFactor: 1.28,
                padding: 30,
                animate: true,
                animationDuration: 560,
              }
        }
        stylesheet={[
          {
            selector: "node",
            style: {
              label: "data(label)",
              color: "#f8fafc",
              "font-size": "11px",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#64748b",
              width: 60,
              height: 60,
              "border-width": 3,
              "border-color": "#e2e8f0",
              "text-wrap": "wrap",
              "text-max-width": "54px",
            },
          },
          {
            selector: 'node[kind = "tool"]',
            style: {
              shape: "ellipse",
              width: 82,
              height: 82,
              "font-size": "8px",
              "background-color": "#143454",
              "border-width": 2,
              "border-color": "#67e8f9",
              color: "#e7fcff",
              "text-max-width": "68px",
              "text-wrap": "wrap",
              "text-valign": "center",
              "text-halign": "center",
              "line-height": 1.15,
            },
          },
          {
            selector: 'node[status = "online"]',
            style: { "background-color": "#10b981" },
          },
          {
            selector: 'node[status = "degraded"]',
            style: { "background-color": "#f59e0b" },
          },
          {
            selector: 'node[status = "offline"]',
            style: { "background-color": "#ef4444" },
          },
          {
            selector: "edge",
            style: {
              label: "data(label)",
              "curve-style": "bezier",
              width: "data(weight)",
              "line-color": "#fb7185",
              opacity: 0.92,
              "target-arrow-color": "#fb7185",
              "target-arrow-shape": "triangle",
              "arrow-scale": 1.5,
              "source-endpoint": "outside-to-node",
              "target-endpoint": "outside-to-node",
              color: "#f8fafc",
              "font-size": "9px",
              "text-background-color": "#0f172a",
              "text-background-opacity": 0.88,
              "text-background-padding": "2px",
              "text-rotation": "autorotate",
              "text-margin-y": "-8px",
            },
          },
          {
            selector: "edge.tool-edge",
            style: {
              width: "data(weight)",
              "line-style": "solid",
              "line-color": "#7dd3fc",
              "target-arrow-shape": "triangle",
              "target-arrow-color": "#7dd3fc",
              "arrow-scale": 1.05,
              opacity: 0.95,
              label: "data(label)",
              "font-size": "8px",
              color: "#dff7ff",
              "text-background-color": "#10243d",
              "text-background-opacity": 0.92,
              "text-background-padding": "2px",
              "text-rotation": "autorotate",
              "text-margin-y": "-6px",
            },
          },
        ]}
        cy={(cy: any) => {
          cyRef.current = cy;
        }}
      />
      {clustered ? (
        <div className="cluster-overlay" aria-hidden="true">
          <div className="cluster-ring cluster-ring-entry">
            <span>Entry Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-retrieval">
            <span>Retrieval Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-context">
            <span>Context Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-files">
            <span>Files Cluster</span>
          </div>
          <div className="cluster-ring cluster-ring-sandbox">
            <span>Sandbox Cluster</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
