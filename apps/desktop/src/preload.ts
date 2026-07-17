import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type DatasetPreview,
  type DatasetPreviewRequest,
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
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
