export interface BlaxelFunctionRecord {
  name: string;
  displayName: string;
  transport: string;
  url: string | null;
  enabled: boolean;
  status: string;
}

interface BlaxelFunctionApiRecord {
  metadata?: {
    name?: string;
    displayName?: string;
    url?: string;
  };
  spec?: {
    enabled?: boolean;
    runtime?: {
      transport?: string;
    };
  };
  status?: {
    phase?: string;
    state?: string;
  };
}

export class BlaxelFunctionsService {
  getConfiguredFunctionName() {
    return process.env.BLAXEL_ATLAS_FUNCTION_NAME ?? null;
  }

  private getHeaders() {
    if (!process.env.BL_API_KEY) {
      throw new Error("Missing BL_API_KEY");
    }
    if (!process.env.BL_WORKSPACE) {
      throw new Error("Missing BL_WORKSPACE");
    }

    return {
      Authorization: `Bearer ${process.env.BL_API_KEY}`,
      "X-Blaxel-Workspace": process.env.BL_WORKSPACE,
    };
  }

  async listFunctions(): Promise<BlaxelFunctionRecord[]> {
    const response = await fetch("https://api.blaxel.ai/v0/functions", {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Blaxel functions listing failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as BlaxelFunctionApiRecord[];
    return payload.map((item) => ({
      name: item.metadata?.name ?? "unknown",
      displayName: item.metadata?.displayName ?? item.metadata?.name ?? "unknown",
      transport: item.spec?.runtime?.transport ?? "unknown",
      url: item.metadata?.url ?? null,
      enabled: item.spec?.enabled ?? true,
      status: item.status?.phase ?? item.status?.state ?? "unknown",
    }));
  }

  async resolveFunction(name: string): Promise<BlaxelFunctionRecord | null> {
    const functions = await this.listFunctions();
    return functions.find((item) => item.name === name) ?? null;
  }
}
