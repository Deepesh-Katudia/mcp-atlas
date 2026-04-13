import type { DashboardSnapshot } from "@mcp-atlas/contracts";

const clusterPositions: Record<string, { x: number; y: number }> = {
  "Gateway MCP": { x: 450, y: 120 },
  "Search MCP": { x: 160, y: 310 },
  "Memory MCP": { x: 760, y: 340 },
  "File MCP": { x: 450, y: 530 },
  "Atlas Blaxel MCP": { x: 760, y: 120 },
};

export type GraphElement = {
  data: Record<string, string | number | null>;
  classes?: string;
  position?: { x: number; y: number };
};

export type GraphElementsBundle = {
  flat: GraphElement[];
  clustered: GraphElement[];
};

function scaleEdgeWeight(volume: number) {
  return Math.min(8, Math.max(2.2, 1.5 + Math.sqrt(volume) * 0.72));
}

function formatToolLabel(toolName: string) {
  const spaced = toolName.replace(/^codegen/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return words[0] ?? toolName;
  }

  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

function toolClusterPosition(server: string, index: number, total: number) {
  const base = clusterPositions[server];
  if (!base) {
    return undefined;
  }

  const radius = total > 3 ? 120 : 104;
  const angleStep = (Math.PI * 2) / Math.max(total, 1);
  const angle = -Math.PI / 2 + index * angleStep;

  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + Math.sin(angle) * radius,
  };
}

export function buildTopologyElements(snapshot: DashboardSnapshot): GraphElementsBundle {
  const flatNodes: GraphElement[] = snapshot.servers.map((server) => ({
    data: {
      id: server.name,
      label: server.name,
      status: server.status,
      kind: "mcp",
      clusterX: clusterPositions[server.name]?.x ?? null,
      clusterY: clusterPositions[server.name]?.y ?? null,
    },
  }));

  const flatEdges: GraphElement[] = snapshot.dependencies.map((edge) => ({
    data: {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: `${edge.volume} req`,
      weight: scaleEdgeWeight(edge.volume),
      volume: edge.volume,
    },
  }));

  const toolNodes: GraphElement[] = [];
  const toolEdges: GraphElement[] = [];

  snapshot.toolsets.forEach((toolset) => {
    const visibleTools = toolset.tools.slice().sort((a, b) => b.requestCount - a.requestCount).slice(0, 4);
    visibleTools.forEach((tool, index) => {
      const nodeId = `${toolset.server}::${tool.id}`;
      const clusterPosition = toolClusterPosition(toolset.server, index, visibleTools.length);

      toolNodes.push({
        data: {
          id: nodeId,
          label: formatToolLabel(tool.name),
          kind: "tool",
          status: null,
          clusterX: clusterPosition?.x ?? null,
          clusterY: clusterPosition?.y ?? null,
          description: tool.description ?? "",
          parentServer: toolset.server,
        },
        position: clusterPosition,
      });

      toolEdges.push({
        data: {
          id: `${toolset.server}->${nodeId}`,
          source: nodeId,
          target: toolset.server,
          label: tool.requestCount > 0 ? `${tool.requestCount} req\n${tool.averageLatencyMs}ms` : "0 req",
          weight: tool.requestCount > 0 ? Math.min(4.2, 1.6 + Math.sqrt(tool.requestCount) * 0.5) : 1.6,
          volume: tool.requestCount,
        },
        classes: "tool-edge",
      });
    });
  });

  return {
    flat: [...flatNodes, ...toolNodes, ...flatEdges, ...toolEdges],
    clustered: [...flatNodes, ...toolNodes, ...flatEdges, ...toolEdges],
  };
}
