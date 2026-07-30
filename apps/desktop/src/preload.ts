import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type AggregateAgentApproval,
  type AggregateAgentPreparation,
  type AggregateAgentProposal,
  type AggregateAgentRun,
  type AgentDefinition,
  type AgentDefinitionId,
  type AgentDefinitionRegistry,
  type AgentDefinitionSaveInput,
  type PortableRendererPreferences,
  type ConfigurationBackupSelectionResult,
  type ConfigurationRestoreSelectionResult,
  type ConfigurationRestoreFinalization,
  type AggregateExplanation,
  type AggregateExplanationApproval,
  type AggregateExplanationPreparation,
  type AggregateExplanationProposal,
  type ExplicitRowDisclosureSelection,
  type ExplicitRowDisclosureProposal,
  type ExplicitRowDisclosureApproval,
  type ExplicitRowExplanation,
  type KnowledgeSource,
  type KnowledgeSearchInput,
  type KnowledgeSearchResult,
  type KnowledgeDisclosurePreparation,
  type KnowledgeDisclosureProposal,
  type KnowledgeDisclosureApproval,
  type KnowledgeAnswer,
  type ColumnDistribution,
  type ColumnDistributionRequest,
  type ConversationTarget,
  type ConversationCreateInput,
  type ConversationRenameInput,
  type ConversationArchiveInput,
  type ConversationDeleteInput,
  type ConversationDeletionResult,
  type ConversationRetentionPolicy,
  type DataBackupSelectionResult,
  type DataRestoreSelectionResult,
  type ConversationThread,
  type ConversationThreadSummary,
  type ConversationEntryPage,
  type ConversationEntryPageRequest,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetStructure,
  type DatasetReplacementSelectionResult,
  type DatasetReplacementMappingInput,
  type DatasetReplacementResult,
  type DatasetImportResult,
  type DatasetRenameInput,
  type DatasetVersionSummary,
  type DatasetExportSelectionResult,
  type DatasetDeletionSelectionResult,
  type DatasetQualityReport,
  type DatasetGroup,
  type DatasetGroupId,
  type DatasetGroupSaveInput,
  type DatasetSummary,
  type DemoWorkspaceId,
  type DemoWorkspaceImportResult,
  type DerivedDatasetCreateInput,
  type DerivedDatasetLineage,
  type DerivedDatasetMaterializationResult,
  type DerivedDependencyPlan,
  type DerivedRecomputeEvent,
  type DataCleanPreviewRequest,
  type DataCleanProposal,
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
  type WorkflowApprovalDecisionInput,
  type WorkflowApprovalRequest,
  type ModelAuditEvent,
  type McpConnectionConfigurationInput,
  type McpConnectionId,
  type McpConnectionRegistryState,
  type McpExecutableSelection,
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
  type McpPromptModelPreparation,
  type McpPromptModelProposal,
  type McpPromptModelApproval,
  type McpPromptModelAnswer,
  type McpModelToolPreparation,
  type McpModelToolProposal,
  type McpModelToolApproval,
  type McpModelToolExecutionProposal,
  type RemoteMcpConnectionConfigurationInput,
  type RemoteMcpRegistryState,
  type RemoteMcpOAuthStartProposal,
  type RemoteMcpOAuthApproval,
  type RemoteMcpInspectionProposal,
  type RemoteMcpInspectionApproval,
  type RemoteMcpToolCallProposal,
  type RemoteMcpToolCallApproval,
  type RemoteMcpAuditEvent,
  type WebhookDestinationInput,
  type WebhookRegistry,
  type WorkflowDeliveryBindingInput,
  type WorkflowDeliveryBinding,
  type ExternalDeliveryJob,
  type HubConnectionInput,
  type HubConnectionProfile,
  type HubBootstrapRequest,
  type HubQueueWorkflowRequest,
  type LocalSyncQueueItem,
  type LocalSyncedObject,
  type LocalSyncedObjectPreview,
  type HubAuditPage,
  type HubResolveConflictInput,
  type HubQueueDeleteInput,
  type HubApplyRemoteObjectInput,
  type HubAppliedObjectReceipt,
  type ArtifactTableActionInput,
  type ArtifactCopyResult,
  type ArtifactExportResult,
  type ProductMetricInput,
  type ReconciliationPreviewRequest,
  type ReconciliationProposal,
  type ReconciliationArtifact,
  type ReconciliationDefinition,
  type ReconciliationReplayEvent,
  type ReportBundleExportResult,
  type ReportBundleInput,
  type FileArrivalApproval,
  type FileArrivalReplacementResult,
  type FileArrivalState,
  type PrivacyPolicy,
  type PrivacyTextInspection,
} from "./shared/product-api.js";

const desktopApi: BuBuDesktopApi = {
  system: {
    getReadiness: () =>
      ipcRenderer.invoke(desktopChannels.getReadiness) as Promise<ProductReadiness>,
  },
  datasets: {
    importFiles: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.importDatasets, { operationId }) as Promise<DatasetImportResult>,
    importDemo: (demoId: DemoWorkspaceId, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.importDemoWorkspace, { operationId, value: demoId }) as Promise<DemoWorkspaceImportResult>,
    materializeDerived: (input: DerivedDatasetCreateInput, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.materializeDerivedDataset, { operationId, value: input }) as Promise<DerivedDatasetMaterializationResult>,
    prepareDataClean: (input: DataCleanPreviewRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.prepareDataClean, { operationId, value: input }) as Promise<DataCleanProposal>,
    approveDataClean: (approvalToken: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveDataClean, { operationId, value: { approvalToken } }) as Promise<DerivedDatasetMaterializationResult>,
    dismissDataClean: (approvalToken: string) =>
      ipcRenderer.invoke(desktopChannels.dismissDataClean, { approvalToken }) as Promise<void>,
    recomputeDerived: (datasetId: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.recomputeDerivedDataset, { operationId, value: datasetId }) as Promise<DerivedDatasetMaterializationResult>,
    lineage: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.getDerivedDatasetLineage, datasetId) as Promise<DerivedDatasetLineage | null>,
    dependencies: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.getDerivedDependencyPlan, datasetId) as Promise<DerivedDependencyPlan>,
    recomputeEvents: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.listDerivedRecomputeEvents, datasetId) as Promise<readonly DerivedRecomputeEvent[]>,
    retryRecompute: (eventId: string) =>
      ipcRenderer.invoke(desktopChannels.retryDerivedRecomputeEvent, eventId) as Promise<DerivedRecomputeEvent>,
    cancelRecompute: (eventId: string) =>
      ipcRenderer.invoke(desktopChannels.cancelDerivedRecomputeEvent, eventId) as Promise<DerivedRecomputeEvent>,
    rename: (input: DatasetRenameInput) =>
      ipcRenderer.invoke(desktopChannels.renameDataset, input) as Promise<DatasetSummary>,
    versions: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.listDatasetVersions, datasetId) as Promise<readonly DatasetVersionSummary[]>,
    export: (datasetId: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.exportDataset, { operationId, value: datasetId }) as Promise<DatasetExportSelectionResult>,
    delete: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.deleteDataset, datasetId) as Promise<DatasetDeletionSelectionResult>,
    list: () => ipcRenderer.invoke(desktopChannels.listDatasets) as Promise<readonly DatasetSummary[]>,
    structure: (datasetId: string) =>
      ipcRenderer.invoke(desktopChannels.getDatasetStructure, datasetId) as Promise<DatasetStructure>,
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
  fileArrivals: {
    configure: () => ipcRenderer.invoke(desktopChannels.configureFileArrivals) as Promise<FileArrivalState>,
    list: () => ipcRenderer.invoke(desktopChannels.listFileArrivals) as Promise<FileArrivalState>,
    approve: (value: FileArrivalApproval, operationId: OperationId) => ipcRenderer.invoke(desktopChannels.approveFileArrival, { operationId, value }) as Promise<FileArrivalReplacementResult>,
    dismiss: (arrivalId: string) => ipcRenderer.invoke(desktopChannels.dismissFileArrival, { arrivalId }) as Promise<FileArrivalState>,
  },
  reconciliation: {
    prepare: (input: ReconciliationPreviewRequest, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.prepareReconciliation, { operationId, value: input }) as Promise<ReconciliationProposal>,
    approve: (approvalToken: string, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveReconciliation, { operationId, value: { approvalToken } }) as Promise<ReconciliationArtifact>,
    dismiss: (approvalToken: string) => ipcRenderer.invoke(desktopChannels.dismissReconciliation, { approvalToken }) as Promise<void>,
    artifact: (id: string) => ipcRenderer.invoke(desktopChannels.getReconciliationArtifact, id) as Promise<ReconciliationArtifact>,
    saveDefinition: (artifactId: string) => ipcRenderer.invoke(desktopChannels.saveReconciliationDefinition, artifactId) as Promise<ReconciliationDefinition>,
    artifacts: (datasetIds: readonly string[]) => ipcRenderer.invoke(desktopChannels.listReconciliationArtifacts, datasetIds) as Promise<readonly ReconciliationArtifact[]>,
    replayEvents: (datasetIds: readonly string[]) => ipcRenderer.invoke(desktopChannels.listReconciliationReplayEvents, datasetIds) as Promise<readonly ReconciliationReplayEvent[]>,
    retryReplay: (eventId: string) => ipcRenderer.invoke(desktopChannels.retryReconciliationReplayEvent, eventId) as Promise<ReconciliationReplayEvent>,
    cancelReplay: (eventId: string) => ipcRenderer.invoke(desktopChannels.cancelReconciliationReplayEvent, eventId) as Promise<ReconciliationReplayEvent>,
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
    selectExecutable: () =>
      ipcRenderer.invoke(desktopChannels.selectMcpExecutable) as Promise<McpExecutableSelection>,
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
    preparePromptModel: (value: McpPromptModelPreparation) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpPromptModel, value) as Promise<McpPromptModelProposal>,
    approvePromptModel: (value: McpPromptModelApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpPromptModel, { operationId, value }) as Promise<McpPromptModelAnswer>,
    prepareModelTool: (value: McpModelToolPreparation) =>
      ipcRenderer.invoke(desktopChannels.prepareMcpModelTool, value) as Promise<McpModelToolProposal>,
    approveModelTool: (value: McpModelToolApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveMcpModelTool, { operationId, value }) as Promise<McpModelToolExecutionProposal>,
    executeModelTool: (value: McpToolCallApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.executeMcpModelTool, { operationId, value }) as Promise<McpToolCallResult>,
    dismissModel: (value: McpPromptModelApproval | McpModelToolApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissMcpModel, value) as Promise<void>,
  },
  remoteMcp: {
    list: () => ipcRenderer.invoke(desktopChannels.listRemoteMcp) as Promise<RemoteMcpRegistryState>,
    listAudits: () => ipcRenderer.invoke(desktopChannels.listRemoteMcpAudits) as Promise<readonly RemoteMcpAuditEvent[]>,
    save: (value: RemoteMcpConnectionConfigurationInput) => ipcRenderer.invoke(desktopChannels.saveRemoteMcp, value) as Promise<RemoteMcpRegistryState>,
    remove: (connectionId: string) => ipcRenderer.invoke(desktopChannels.removeRemoteMcp, connectionId) as Promise<RemoteMcpRegistryState>,
    prepareOAuth: (connectionId: string) => ipcRenderer.invoke(desktopChannels.prepareRemoteMcpOAuth, connectionId) as Promise<RemoteMcpOAuthStartProposal>,
    approveOAuth: (value: RemoteMcpOAuthApproval, operationId: OperationId) => ipcRenderer.invoke(desktopChannels.approveRemoteMcpOAuth, { operationId, value }) as Promise<RemoteMcpRegistryState>,
    revokeOAuth: (connectionId: string) => ipcRenderer.invoke(desktopChannels.revokeRemoteMcpOAuth, connectionId) as Promise<RemoteMcpRegistryState>,
    refreshOAuth: (connectionId: string) => ipcRenderer.invoke(desktopChannels.refreshRemoteMcpOAuth, connectionId) as Promise<RemoteMcpRegistryState>,
    prepareInspection: (connectionId: string) => ipcRenderer.invoke(desktopChannels.prepareRemoteMcpInspection, connectionId) as Promise<RemoteMcpInspectionProposal>,
    approveInspection: (value: RemoteMcpInspectionApproval, operationId: OperationId) => ipcRenderer.invoke(desktopChannels.approveRemoteMcpInspection, { operationId, value }) as Promise<McpInspectionSnapshot>,
    dismissInspection: (value: RemoteMcpInspectionApproval) => ipcRenderer.invoke(desktopChannels.dismissRemoteMcpInspection, value) as Promise<void>,
    prepareTool: (value: McpToolCallRequest) => ipcRenderer.invoke(desktopChannels.prepareRemoteMcpTool, value) as Promise<RemoteMcpToolCallProposal>,
    approveTool: (value: RemoteMcpToolCallApproval, operationId: OperationId) => ipcRenderer.invoke(desktopChannels.approveRemoteMcpTool, { operationId, value }) as Promise<McpToolCallResult>,
    dismissTool: (value: RemoteMcpToolCallApproval) => ipcRenderer.invoke(desktopChannels.dismissRemoteMcpTool, value) as Promise<void>,
  },
  dataProtection: {
    createBackup: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.createBackup, { operationId }) as Promise<DataBackupSelectionResult>,
    restoreBackup: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.restoreBackup, { operationId }) as Promise<DataRestoreSelectionResult>,
    createConfigurationBackup: (value: PortableRendererPreferences) =>
      ipcRenderer.invoke(desktopChannels.createConfigurationBackup, value) as Promise<ConfigurationBackupSelectionResult>,
    restoreConfigurationBackup: () =>
      ipcRenderer.invoke(desktopChannels.restoreConfigurationBackup) as Promise<ConfigurationRestoreSelectionResult>,
    finalizeConfigurationRestore: (value: ConfigurationRestoreFinalization) =>
      ipcRenderer.invoke(desktopChannels.finalizeConfigurationRestore, value) as Promise<void>,
  },
  knowledge: {
    importSource: () => ipcRenderer.invoke(desktopChannels.importKnowledgeSource) as Promise<KnowledgeSource | null>,
    listSources: () => ipcRenderer.invoke(desktopChannels.listKnowledgeSources) as Promise<readonly KnowledgeSource[]>,
    rebuildSource: (sourceId: string) => ipcRenderer.invoke(desktopChannels.rebuildKnowledgeSource, sourceId) as Promise<KnowledgeSource>,
    deleteSource: (sourceId: string) => ipcRenderer.invoke(desktopChannels.deleteKnowledgeSource, sourceId) as Promise<void>,
    search: (value: KnowledgeSearchInput) => ipcRenderer.invoke(desktopChannels.searchKnowledge, value) as Promise<KnowledgeSearchResult>,
    prepareAnswer: (value: KnowledgeDisclosurePreparation) => ipcRenderer.invoke(desktopChannels.prepareKnowledgeAnswer, value) as Promise<KnowledgeDisclosureProposal>,
    approveAnswer: (value: KnowledgeDisclosureApproval, operationId: OperationId) => ipcRenderer.invoke(desktopChannels.approveKnowledgeAnswer, { operationId, value }) as Promise<KnowledgeAnswer>,
    dismissAnswer: (value: KnowledgeDisclosureApproval) => ipcRenderer.invoke(desktopChannels.dismissKnowledgeAnswer, value) as Promise<void>,
  },
  privacyPolicy: {
    get: () => ipcRenderer.invoke(desktopChannels.getPrivacyPolicy) as Promise<PrivacyPolicy>,
    save: (value: PrivacyPolicy) => ipcRenderer.invoke(desktopChannels.savePrivacyPolicy, value) as Promise<PrivacyPolicy>,
    inspectText: (value: string) => ipcRenderer.invoke(desktopChannels.inspectPrivacyText, value) as Promise<PrivacyTextInspection>,
  },
  agentDefinitions: {
    list: () => ipcRenderer.invoke(desktopChannels.listAgentDefinitions) as Promise<AgentDefinitionRegistry>,
    save: (value: AgentDefinitionSaveInput) => ipcRenderer.invoke(desktopChannels.saveAgentDefinition, value) as Promise<AgentDefinition>,
    remove: (id: AgentDefinitionId) => ipcRenderer.invoke(desktopChannels.removeAgentDefinition, id) as Promise<AgentDefinitionRegistry>,
  },
  operations: {
    cancel: (operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.cancelOperation, operationId) as Promise<OperationCancellationResult>,
  },
  artifacts: {
    copyTable: (value: ArtifactTableActionInput) => ipcRenderer.invoke(desktopChannels.copyArtifactTable, value) as Promise<ArtifactCopyResult>,
    exportTable: (value: ArtifactTableActionInput) => ipcRenderer.invoke(desktopChannels.exportArtifactTable, value) as Promise<ArtifactExportResult>,
    exportReport: (value: ReportBundleInput) => ipcRenderer.invoke(desktopChannels.exportArtifactReport, value) as Promise<ReportBundleExportResult>,
  },
  metrics: {
    record: (value: ProductMetricInput) => ipcRenderer.invoke(desktopChannels.recordProductMetric, value) as Promise<void>,
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
    prepareExplicitRowDisclosure: (value: ExplicitRowDisclosureSelection) =>
      ipcRenderer.invoke(desktopChannels.prepareExplicitRowDisclosure, value) as Promise<ExplicitRowDisclosureProposal>,
    approveExplicitRowDisclosure: (value: ExplicitRowDisclosureApproval, operationId: OperationId) =>
      ipcRenderer.invoke(desktopChannels.approveExplicitRowDisclosure, { operationId, value }) as Promise<ExplicitRowExplanation>,
    dismissExplicitRowDisclosure: (value: ExplicitRowDisclosureApproval) =>
      ipcRenderer.invoke(desktopChannels.dismissExplicitRowDisclosure, value) as Promise<void>,
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
    page: (request: ConversationEntryPageRequest) =>
      ipcRenderer.invoke(desktopChannels.pageConversationEntries, request) as Promise<ConversationEntryPage>,
    list: (target: ConversationTarget, archived = false) =>
      ipcRenderer.invoke(desktopChannels.listConversations, { target, archived }) as Promise<readonly ConversationThreadSummary[]>,
    create: (input: ConversationCreateInput) =>
      ipcRenderer.invoke(desktopChannels.createConversation, input) as Promise<ConversationThread>,
    rename: (input: ConversationRenameInput) =>
      ipcRenderer.invoke(desktopChannels.renameConversation, input) as Promise<ConversationThread>,
    archive: (input: ConversationArchiveInput) =>
      ipcRenderer.invoke(desktopChannels.archiveConversation, input) as Promise<void>,
    delete: (input: ConversationDeleteInput) =>
      ipcRenderer.invoke(desktopChannels.deleteConversation, input) as Promise<ConversationDeletionResult>,
    retentionPolicy: () =>
      ipcRenderer.invoke(desktopChannels.getConversationRetentionPolicy) as Promise<ConversationRetentionPolicy>,
    saveRetentionPolicy: (policy: ConversationRetentionPolicy) =>
      ipcRenderer.invoke(desktopChannels.saveConversationRetentionPolicy, policy) as Promise<ConversationRetentionPolicy>,
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
    approvals: () =>
      ipcRenderer.invoke(desktopChannels.listWorkflowApprovals) as Promise<readonly WorkflowApprovalRequest[]>,
    decideApproval: (input: WorkflowApprovalDecisionInput) =>
      ipcRenderer.invoke(desktopChannels.decideWorkflowApproval, input) as Promise<WorkflowRun>,
  },
  externalDelivery: {
    listDestinations: () => ipcRenderer.invoke(desktopChannels.listWebhookDestinations) as Promise<WebhookRegistry>,
    saveDestination: (value: WebhookDestinationInput) => ipcRenderer.invoke(desktopChannels.saveWebhookDestination, value) as Promise<WebhookRegistry>,
    removeDestination: (destinationId: string) => ipcRenderer.invoke(desktopChannels.removeWebhookDestination, destinationId) as Promise<WebhookRegistry>,
    listBindings: () => ipcRenderer.invoke(desktopChannels.listWorkflowDeliveryBindings) as Promise<readonly WorkflowDeliveryBinding[]>,
    bind: (value: WorkflowDeliveryBindingInput) => ipcRenderer.invoke(desktopChannels.bindWorkflowDelivery, value) as Promise<readonly WorkflowDeliveryBinding[]>,
    unbind: (workflowId: string) => ipcRenderer.invoke(desktopChannels.unbindWorkflowDelivery, workflowId) as Promise<readonly WorkflowDeliveryBinding[]>,
    test: (destinationId: string) => ipcRenderer.invoke(desktopChannels.testWebhookDestination, destinationId) as Promise<ExternalDeliveryJob>,
    jobs: () => ipcRenderer.invoke(desktopChannels.listExternalDeliveryJobs) as Promise<readonly ExternalDeliveryJob[]>,
  },
  hub: {
    profile: () => ipcRenderer.invoke(desktopChannels.getHubProfile) as Promise<HubConnectionProfile | null>,
    configure: (value: HubConnectionInput) => ipcRenderer.invoke(desktopChannels.configureHub, value) as Promise<HubConnectionProfile>,
    bootstrap: (value: HubBootstrapRequest) => ipcRenderer.invoke(desktopChannels.bootstrapHub, value) as Promise<HubConnectionProfile>,
    disconnect: () => ipcRenderer.invoke(desktopChannels.disconnectHub) as Promise<void>,
    queueWorkflow: (value: HubQueueWorkflowRequest) => ipcRenderer.invoke(desktopChannels.queueHubWorkflow, value) as Promise<LocalSyncQueueItem>,
    queue: () => ipcRenderer.invoke(desktopChannels.listHubQueue) as Promise<readonly LocalSyncQueueItem[]>,
    deleteObject: (value: HubQueueDeleteInput) => ipcRenderer.invoke(desktopChannels.deleteHubObject, value) as Promise<LocalSyncQueueItem>,
    resolveConflict: (value: HubResolveConflictInput) => ipcRenderer.invoke(desktopChannels.resolveHubConflict, value) as Promise<LocalSyncQueueItem>,
    flush: () => ipcRenderer.invoke(desktopChannels.flushHubQueue) as Promise<readonly LocalSyncQueueItem[]>,
    pull: () => ipcRenderer.invoke(desktopChannels.pullHubObjects) as Promise<readonly LocalSyncedObject[]>,
    objects: () => ipcRenderer.invoke(desktopChannels.listHubObjects) as Promise<readonly LocalSyncedObject[]>,
    inspect: (objectId: string, version: number) => ipcRenderer.invoke(desktopChannels.inspectHubObject, { objectId, version }) as Promise<LocalSyncedObjectPreview>,
    apply: (value: HubApplyRemoteObjectInput) => ipcRenderer.invoke(desktopChannels.applyHubObject, value) as Promise<HubAppliedObjectReceipt>,
    applications: () => ipcRenderer.invoke(desktopChannels.listHubApplications) as Promise<readonly HubAppliedObjectReceipt[]>,
    audit: () => ipcRenderer.invoke(desktopChannels.getHubAudit) as Promise<{ readonly page: HubAuditPage; readonly verified: boolean }>,
  },
  privacy: {
    listModelAudits: () =>
      ipcRenderer.invoke(desktopChannels.listModelAudits) as Promise<readonly ModelAuditEvent[]>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
