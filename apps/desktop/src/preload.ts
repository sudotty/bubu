import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type AggregateAgentApproval,
  type AggregateAgentPreparation,
  type AggregateAgentProposal,
  type AggregateAgentRun,
  type AggregateExplanation,
  type AggregateExplanationApproval,
  type AggregateExplanationPreparation,
  type AggregateExplanationProposal,
  type ColumnDistribution,
  type ColumnDistributionRequest,
  type ConversationTarget,
  type ConversationCreateInput,
  type ConversationRenameInput,
  type ConversationArchiveInput,
  type DataBackupSelectionResult,
  type DataRestoreSelectionResult,
  type ConversationThread,
  type ConversationThreadSummary,
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
  type QueryPlanExecutionRequest,
  type SafeQueryPlan,
  type SafeQueryResult,
  type ProductReadiness,
  type GroupQueryPlanProposal,
  type GroupRelationshipOverview,
  type GroupQueryRequest,
  type GroupQueryPlanExecutionRequest,
  type OperationCancellationResult,
  type OperationId,
  type SafeGroupQueryPlan,
  type SafeGroupQueryResult,
  type WorkflowDefinition,
  type WorkflowDefinitionInput,
  type WorkflowRun,
  type WorkflowTarget,
  type ModelAuditEvent,
  type McpConnectionConfigurationInput,
  type McpConnectionId,
  type McpConnectionRegistryState,
  type McpInspectionApproval,
  type McpInspectionProposal,
  type McpInspectionSnapshot,
  type McpAuditEvent,
  type McpResourceReadApproval,
  type McpResourceReadProposal,
  type McpResourceReadRequest,
  type McpResourceReadResult,
  type McpPromptGetApproval,
  type McpPromptGetProposal,
  type McpPromptGetRequest,
  type McpPromptGetResult,
  type McpToolCallApproval,
  type McpToolCallProposal,
  type McpToolCallRequest,
  type McpToolCallResult,
  type ArtifactTableActionInput,
  type ArtifactCopyResult,
  type ArtifactExportResult,
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
  mcp: {
    list: () =>
      ipcRenderer.invoke(desktopChannels.listMcpConnections) as Promise<McpConnectionRegistryState>,
    save: (value: McpConnectionConfigurationInput) =>
      ipcRenderer.invoke(desktopChannels.saveMcpConnection, value) as Promise<McpConnectionRegistryState>,
    remove: (connectionId: McpConnectionId) =>
      ipcRenderer.invoke(desktopChannels.removeMcpConnection, connectionId) as Promise<McpConnectionRegistryState>,
    prepareInspection: (connectionId: McpConnectionId) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpInspection, connectionId) as Promise<McpInspectionProposal>,
    approveInspection: (value: McpInspectionApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpInspection, { operationId, value }) as Promise<McpInspectionSnapshot>,
    dismissInspection: (value: McpInspectionApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissMcpInspection, value) as Promise<void>,
    listAudits: () =>
      ipcRenderer.invoke(desktopChannels.listMcpAudits) as Promise<readonly McpAuditEvent[]>,
    prepareResourceRead: (value: McpResourceReadRequest) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpResourceRead, value) as Promise<McpResourceReadProposal>,
    approveResourceRead: (value: McpResourceReadApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpResourceRead, { operationId, value }) as Promise<McpResourceReadResult>,
    dismissResourceRead: (value: McpResourceReadApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissMcpResourceRead, value) as Promise<void>,
    preparePromptGet: (value: McpPromptGetRequest) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpPromptGet, value) as Promise<McpPromptGetProposal>,
    approvePromptGet: (value: McpPromptGetApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpPromptGet, { operationId, value }) as Promise<McpPromptGetResult>,
    dismissPromptGet: (value: McpPromptGetApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissMcpPromptGet, value) as Promise<void>,
    prepareToolCall: (value: McpToolCallRequest) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpToolCall, value) as Promise<McpToolCallProposal>,
    approveToolCall: (value: McpToolCallApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpToolCall, { operationId, value }) as Promise<McpToolCallResult>,
    dismissToolCall: (value: McpToolCallApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissMcpToolCall, value) as Promise<void>,
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
  artifacts: {
    copyTable: (value: ArtifactTableActionInput) => ipcRenderer.invoke(desktopChannels.copyArtifactTable, value) as Promise<ArtifactCopyResult>,
    exportTable: (value: ArtifactTableActionInput) => ipcRenderer.invoke(desktopChannels.exportArtifactTable, value) as Promise<ArtifactExportResult>,
  },
  analysis: {
    propose: (value: QueryPlanRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.proposeQueryPlan, { operationId, value }) as Promise<QueryPlanProposal>,
    execute: (value: QueryPlanExecutionRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.executeQueryPlan, { operationId, value }) as Promise<SafeQueryResult>,
    proposeGroup: (value: GroupQueryRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.proposeGroupQueryPlan, { operationId, value }) as Promise<GroupQueryPlanProposal>,
    executeGroup: (value: GroupQueryPlanExecutionRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.executeGroupQueryPlan, { operationId, value }) as Promise<SafeGroupQueryResult>,
    prepareAggregateExplanation: (value: AggregateExplanationPreparation) =>
      ipcRenderer.invoke(desktopChannels.prepareAggregateExplanation, value) as Promise<AggregateExplanationProposal>,
    approveAggregateExplanation: (value: AggregateExplanationApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveAggregateExplanation, { operationId, value }) as Promise<AggregateExplanation>,
    dismissAggregateExplanation: (value: AggregateExplanationApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissAggregateExplanation, value) as Promise<void>,
    prepareAggregateAgent: (value: AggregateAgentPreparation) =>
      ipcRenderer.invoke(desktopChannels.prepareAggregateAgent, value) as Promise<AggregateAgentProposal>,
    approveAggregateAgent: (value: AggregateAgentApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveAggregateAgent, { operationId, value }) as Promise<AggregateAgentRun>,
    dismissAggregateAgent: (value: AggregateAgentApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissAggregateAgent, value) as Promise<void>,
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
    getById: (threadId: string) =>
      ipcRenderer.invoke(desktopChannels.getConversationById, threadId) as Promise<ConversationThread | null>,
    list: (target: ConversationTarget, archived = false) =>
      ipcRenderer.invoke(desktopChannels.listConversations, { target, archived }) as Promise<readonly ConversationThreadSummary[]>,
    create: (input: ConversationCreateInput) =>
      ipcRenderer.invoke(desktopChannels.createConversation, input) as Promise<ConversationThread>,
    rename: (input: ConversationRenameInput) =>
      ipcRenderer.invoke(desktopChannels.renameConversation, input) as Promise<ConversationThread>,
    archive: (input: ConversationArchiveInput) =>
      ipcRenderer.invoke(desktopChannels.archiveConversation, input) as Promise<void>,
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
