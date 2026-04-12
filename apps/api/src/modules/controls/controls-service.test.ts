import { describe, expect, it, vi } from "vitest";
import { ControlsService } from "./controls-service.js";

describe("ControlsService", () => {
  it("runs a Blaxel processes-list call through the adapter", async () => {
    const blaxelAdapter = {
      describeServer: () => ({ name: "Atlas Blaxel MCP" }),
      callTool: vi.fn().mockResolvedValue({ processes: [{ pid: 1 }] }),
    };

    const service = new ControlsService({
      registry: {
        getAdapter(slug: string) {
          return slug === "atlas-blaxel-mcp" ? blaxelAdapter : null;
        },
      },
      telemetry: {
        ingest: vi.fn(),
      },
    });

    const result = await service.callMcpTool("atlas-blaxel-mcp", "processesList", {});

    expect(result).toEqual({ processes: [{ pid: 1 }] });
    expect(blaxelAdapter.callTool).toHaveBeenCalledWith("processesList", {});
  });
});
