import type {
  DatasetImportResult,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetReplacementResult,
  DatasetSummary,
  ProviderConfigurationInput,
  ProviderConnectionResult,
  ProviderId,
  ProviderRegistryState,
} from "@bubu/contracts";

export const desktopChannels = {
  getReadiness: "bubu:system:get-readiness",
  importDatasets: "bubu:datasets:import",
  listDatasets: "bubu:datasets:list",
  previewDataset: "bubu:datasets:preview",
  replaceDataset: "bubu:datasets:replace",
  listProviders: "bubu:providers:list",
  saveProvider: "bubu:providers:save",
  selectProvider: "bubu:providers:select",
  removeProvider: "bubu:providers:remove",
  testProvider: "bubu:providers:test",
} as const;

export type DatasetReplacementSelectionResult =
  | DatasetReplacementResult
  | { readonly status: "cancelled" };

export type DesktopServiceName = "ai-runtime" | "data-core";
export type DesktopServiceStatus = "ready" | "degraded" | "unavailable";

export interface DesktopServiceHealth {
  readonly name: DesktopServiceName;
  readonly status: DesktopServiceStatus;
  readonly capabilities: readonly string[];
  readonly message?: string;
}

export interface ProductReadiness {
  readonly status: "ready" | "degraded";
  readonly protocolVersion: 1;
  readonly services: readonly DesktopServiceHealth[];
}

export interface BuBuDesktopApi {
  readonly system: {
    getReadiness(): Promise<ProductReadiness>;
  };
  readonly datasets: {
    importFiles(): Promise<DatasetImportResult>;
    list(): Promise<readonly DatasetSummary[]>;
    preview(request: DatasetPreviewRequest): Promise<DatasetPreview>;
    replace(datasetId: string): Promise<DatasetReplacementSelectionResult>;
  };
  readonly providers: {
    list(): Promise<ProviderRegistryState>;
    save(value: ProviderConfigurationInput): Promise<ProviderRegistryState>;
    select(providerId: ProviderId): Promise<ProviderRegistryState>;
    remove(providerId: ProviderId): Promise<ProviderRegistryState>;
    test(providerId: ProviderId): Promise<ProviderConnectionResult>;
  };
}

export type {
  ColumnProfile,
  DatasetImportResult,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetReplacementResult,
  DatasetSummary,
  ProviderConfigurationInput,
  ProviderConnectionResult,
  ProviderId,
  ProviderKind,
  ProviderProfile,
  ProviderRegistryState,
  ProviderSummary,
  SchemaDrift,
} from "@bubu/contracts";
