import type {
  DatasetImportResult,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetSummary,
} from "@bubu/contracts";

export const desktopChannels = {
  getReadiness: "bubu:system:get-readiness",
  importDatasets: "bubu:datasets:import",
  listDatasets: "bubu:datasets:list",
  previewDataset: "bubu:datasets:preview",
} as const;

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
  };
}

export type {
  ColumnProfile,
  DatasetImportResult,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetSummary,
} from "@bubu/contracts";
