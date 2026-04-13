import type { SandboxInstance } from "@blaxel/core";

type SandboxMetadata = {
  name?: string;
  url?: string;
  [key: string]: unknown;
};

export interface BlaxelStatus {
  enabled: boolean;
  connected: boolean;
  sandboxName: string | null;
  sandboxUrl: string | null;
  sandboxMcpUrl: string | null;
  workspace: string | null;
  lastError: string | null;
}

export class BlaxelSandboxService {
  private sandbox: SandboxInstance | null = null;
  private lastError: string | null = null;

  isEnabled() {
    return Boolean(process.env.BL_API_KEY && process.env.BL_WORKSPACE && process.env.BLAXEL_SANDBOX_NAME);
  }

  async initialize() {
    if (!this.isEnabled()) {
      return;
    }

      const { SandboxInstance } = await import("@blaxel/core");

    try {
      const sandboxName = process.env.BLAXEL_SANDBOX_NAME!;
      this.sandbox = await SandboxInstance.createIfNotExists({
        name: sandboxName,
        image: process.env.BLAXEL_SANDBOX_IMAGE ?? "blaxel/base-image:latest",
        memory: Number(process.env.BLAXEL_SANDBOX_MEMORY_MB ?? 4096),
        ports: [{ target: Number(process.env.BLAXEL_SANDBOX_PORT ?? 3000), protocol: "HTTP" }],
        labels: {
          project: "mcp-atlas",
          env: process.env.NODE_ENV ?? "development",
        },
        region: process.env.BLAXEL_SANDBOX_REGION ?? undefined,
      });
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unknown Blaxel initialization error";
    }
  }

  getStatus(): BlaxelStatus {
    const metadata = (this.sandbox?.metadata ?? null) as SandboxMetadata | null;
    const sandboxUrl = metadata?.url ?? null;

    return {
      enabled: this.isEnabled(),
      connected: Boolean(metadata?.name),
      sandboxName: metadata?.name ?? process.env.BLAXEL_SANDBOX_NAME ?? null,
      sandboxUrl,
      sandboxMcpUrl: sandboxUrl ? `${sandboxUrl}/mcp` : null,
      workspace: process.env.BL_WORKSPACE ?? null,
      lastError: this.lastError,
    };
  }
}
