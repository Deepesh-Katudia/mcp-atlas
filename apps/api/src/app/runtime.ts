import { TelemetryStore } from "../store.js";

export interface ApiRuntime {
  store: TelemetryStore;
  registryService: {
    listMcps(): Promise<unknown[]>;
  };
}

export function createRuntime(registryService: ApiRuntime["registryService"]): ApiRuntime {
  return {
    store: new TelemetryStore(),
    registryService,
  };
}
