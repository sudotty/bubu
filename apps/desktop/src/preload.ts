import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetReplacementSelectionResult,
  type DatasetImportResult,
  type DatasetSummary,
  type ProductReadiness,
} from "./shared/product-api.js";

const desktopApi: BuBuDesktopApi = {
  system: {
    getReadiness: () =>
      ipcRenderer.invoke(desktopChannels.getReadiness) as Promise<ProductReadiness>,
  },
  datasets: {
    importFiles: () =>
      ipcRenderer.invoke(desktopChannels.importDatasets) as Promise<DatasetImportResult>,
    list: () => ipcRenderer.invoke(desktopChannels.listDatasets) as Promise<readonly DatasetSummary[]>,
    preview: (request: DatasetPreviewRequest) =>
      ipcRenderer.invoke(desktopChannels.previewDataset, request) as Promise<DatasetPreview>,
    replace: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.replaceDataset, datasetId) as Promise<DatasetReplacementSelectionResult>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
