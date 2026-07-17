import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type ConversationTarget,
  type ConversationThread,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetReplacementSelectionResult,
  type DatasetReplacementMappingInput,
  type DatasetReplacementResult,
  type DatasetImportResult,
  type DatasetGroup,
  type DatasetGroupId,
  type DatasetGroupSaveInput,
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
  type GroupQueryPlanProposal,
  type GroupQueryRequest,
  type SafeGroupQueryPlan,
  type SafeGroupQueryResult,
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
    applyReplacementMapping: (value: DatasetReplacementMappingInput) =>
      ipcRenderer.invoke(desktopChannels.applyReplacementMapping, value) as Promise<DatasetReplacementResult>,
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
    proposeGroup: (value: GroupQueryRequest) =>
      ipcRenderer.invoke(desktopChannels.proposeGroupQueryPlan, value) as Promise<GroupQueryPlanProposal>,
    executeGroup: (plan: SafeGroupQueryPlan) =>
      ipcRenderer.invoke(desktopChannels.executeGroupQueryPlan, plan) as Promise<SafeGroupQueryResult>,
  },
  datasetGroups: {
    list: () =>
      ipcRenderer.invoke(desktopChannels.listDatasetGroups) as Promise<readonly DatasetGroup[]>,
    save: (value: DatasetGroupSaveInput) =>
      ipcRenderer.invoke(desktopChannels.saveDatasetGroup, value) as Promise<DatasetGroup>,
    remove: (groupId: DatasetGroupId) =>
      ipcRenderer.invoke(desktopChannels.removeDatasetGroup, groupId) as Promise<readonly DatasetGroup[]>,
  },
  conversations: {
    get: (target: ConversationTarget) =>
      ipcRenderer.invoke(desktopChannels.getConversation, target) as Promise<ConversationThread | null>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
