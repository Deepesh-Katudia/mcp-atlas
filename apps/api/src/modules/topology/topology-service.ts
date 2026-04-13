import type { DashboardSnapshot } from "@mcp-atlas/contracts";

export class TopologyService {
  fromSnapshot(snapshot: DashboardSnapshot) {
    return {
      nodes: snapshot.servers.map((server) => ({
        id: server.name,
        status: server.status,
      })),
      edges: snapshot.dependencies,
      toolsets: snapshot.toolsets,
    };
  }
}
