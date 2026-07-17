import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type ColumnDistribution,
  type ColumnDistributionRequest,
  type ConversationTarget,
  type DataBackupSelectionResult,
  type DataRestoreSelectionResult,
  type ConversationThread,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetReplacementSelectionResult,
  type DatasetReplacementMappingInput,
  type DatasetReplacementResult,
  type DatasetImportResult,
  type DatasetExportSelectionResult,
  type DatasetDeletionSelectionResult,
  type DatasetQualityReport,
  type DatasetGroup,
  type DatasetGroupId,
  type DatasetGroupSaveInput,
  type DatasetSummary,
  type DatasetValidationSaveInput,
  type DatasetRelationship,
  type DatasetRelationshipSaveInput,
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
  type GroupRelationshipOverview,
  type GroupQueryRequest,
  type OperationCancellationResult,
  type OperationId,
  type SafeGroupQueryPlan,
  type SafeGroupQueryResult,
  type WorkflowDefinition,
  type WorkflowDefinitionInput,
  type WorkflowRun,
  type WorkflowTarget,
  type ModelAuditEvent,
} from "./shared/product-api.js";

const desktopApi: BuBuDesktopApi = {
  system: {
    getReadiness: () =>
      ipcRenderer.invoke(desktopChannels.getReadiness) as Promise<ProductReadiness>,
  },
  datasets: {
    importFiles: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.importDatasets, { operationId }) as Promise<DatasetImportResult>,
    export: (datasetId: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.exportDataset, { operationId, value: datasetId }) as Promise<DatasetExportSelectionResult>,
    delete: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.deleteDataset, datasetId) as Promise<DatasetDeletionSelectionResult>,
    list: () => ipcRenderer.invoke(desktopChannels.listDatasets) as Promise<readonly DatasetSummary[]>,
    preview: (request: DatasetPreviewRequest) =>
      ipcRenderer.invoke(desktopChannels.previewDataset, request) as Promise<DatasetPreview>,
    replace: (datasetId: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.replaceDataset, { operationId, value: datasetId }) as Promise<DatasetReplacementSelectionResult>,
    applyReplacementMapping: (value: DatasetReplacementMappingInput, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.applyReplacementMapping, { operationId, value }) as Promise<DatasetReplacementResult>,
    quality: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.getDatasetQuality, datasetId) as Promise<DatasetQualityReport>,
    distribution: (value: ColumnDistributionRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.getColumnDistribution, { operationId, value }) as Promise<ColumnDistribution>,
    saveValidation: (value: DatasetValidationSaveInput) =>
      ipcRenderer.invoke(desktopChannels.saveDatasetValidation, value) as Promise<DatasetQualityReport>,
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
    test: (providerId: ProviderId, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.testProvider, { operationId, value: providerId }) as Promise<ProviderConnectionResult>,
  },
  dataProtection: {
    createBackup: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.createBackup, { operationId }) as Promise<DataBackupSelectionResult>,
    restoreBackup: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.restoreBackup, { operationId }) as Promise<DataRestoreSelectionResult>,
  },
  operations: {
    cancel: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.cancelOperation, operationId) as Promise<OperationCancellationResult>,
  },
  analysis: {
    propose: (value: QueryPlanRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.proposeQueryPlan, { operationId, value }) as Promise<QueryPlanProposal>,
    execute: (plan: SafeQueryPlan, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.executeQueryPlan, { operationId, value: plan }) as Promise<SafeQueryResult>,
    proposeGroup: (value: GroupQueryRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.proposeGroupQueryPlan, { operationId, value }) as Promise<GroupQueryPlanProposal>,
    executeGroup: (plan: SafeGroupQueryPlan, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.executeGroupQueryPlan, { operationId, value: plan }) as Promise<SafeGroupQueryResult>,
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
  datasetRelationships: {
    overview: (groupId: DatasetGroupId) =>
      ipcRenderer.invoke(desktopChannels.getGroupRelationships, groupId) as Promise<GroupRelationshipOverview>,
    save: (value: DatasetRelationshipSaveInput) =>
      ipcRenderer.invoke(desktopChannels.saveDatasetRelationship, value) as Promise<DatasetRelationship>,
    remove: (relationshipId: string) =>
      ipcRenderer.invoke(desktopChannels.removeDatasetRelationship, relationshipId) as Promise<void>,
  },
  workflows: {
    save: (value: WorkflowDefinitionInput) =>
      ipcRenderer.invoke(desktopChannels.saveWorkflow, value) as Promise<WorkflowDefinition>,
    list: (target: WorkflowTarget) =>
      ipcRenderer.invoke(desktopChannels.listWorkflows, target) as Promise<readonly WorkflowDefinition[]>,
    delete: (workflowId: string) =>
      ipcRenderer.invoke(desktopChannels.deleteWorkflow, workflowId) as Promise<void>,
    run: (workflowId: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.runWorkflow, { operationId, value: workflowId }) as Promise<WorkflowRun>,
    runs: (workflowId: string) =>
      ipcRenderer.invoke(desktopChannels.listWorkflowRuns, workflowId) as Promise<readonly WorkflowRun[]>,
  },
  privacy: {
    listModelAudits: () =>
      ipcRenderer.invoke(desktopChannels.listModelAudits) as Promise<readonly ModelAuditEvent[]>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
