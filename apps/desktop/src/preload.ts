import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetReplacementSelectionResult,
  type DatasetImportResult,
  type DatasetSummary,
  type ProviderConfigurationInput,
  type ProviderConnectionResult,
  type ProviderId,
  type ProviderRegistryState,
  type QueryPlanProposal,
  type QueryPlanRequest,
  type SafeQueryPlan,
  type SafeQueryResult,
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
  providers: {
    list: () =>
      ipcRenderer.invoke(desktopChannels.listProviders) as Promise<ProviderRegistryState>,
    save: (value: ProviderConfigurationInput) =>
      ipcRenderer.invoke(desktopChannels.saveProvider, value) as Promise<ProviderRegistryState>,
    select: (providerId: ProviderId) =>
      ipcRenderer.invoke(desktopChannels.selectProvider, providerId) as Promise<ProviderRegistryState>,
    remove: (providerId: ProviderId) =>
      ipcRenderer.invoke(desktopChannels.removeProvider, providerId) as Promise<ProviderRegistryState>,
    test: (providerId: ProviderId) =>
      ipcRenderer.invoke(desktopChannels.testProvider, providerId) as Promise<ProviderConnectionResult>,
  },
  analysis: {
    propose: (value: QueryPlanRequest) =>
      ipcRenderer.invoke(desktopChannels.proposeQueryPlan, value) as Promise<QueryPlanProposal>,
    execute: (plan: SafeQueryPlan) =>
      ipcRenderer.invoke(desktopChannels.executeQueryPlan, plan) as Promise<SafeQueryResult>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
