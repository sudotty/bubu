import type {
  AggregateAgentApproval,
  AggregateAgentPreparation,
  AggregateAgentProposal,
  AggregateAgentRun,
  AggregateExplanation,
  AggregateExplanationApproval,
  AggregateExplanationPreparation,
  AggregateExplanationProposal,
  ExplicitRowDisclosureSelection,
  ExplicitRowDisclosureProposal,
  ExplicitRowDisclosureApproval,
  ExplicitRowExplanation,
  KnowledgeSource,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  KnowledgeDisclosurePreparation,
  KnowledgeDisclosureProposal,
  KnowledgeDisclosureApproval,
  KnowledgeAnswer,
  ConversationTarget,
  ConversationCreateInput,
  ConversationRenameInput,
  ConversationArchiveInput,
  ConversationDeleteInput,
  ConversationDeletionResult,
  ConversationRetentionPolicy,
  ColumnDistribution,
  ColumnDistributionRequest,
  DataBackupSelectionResult,
  DataRestoreSelectionResult,
  ConversationThread,
  ConversationThreadSummary,
  ConversationEntryPage,
  ConversationEntryPageRequest,
  DatasetGroup,
  DatasetGroupCadence,
  DatasetGroupId,
  DatasetGroupSaveInput,
  DatasetImportResult,
  DatasetRenameInput,
  DatasetVersionSummary,
  DatasetExportSelectionResult,
  DatasetDeletionSelectionResult,
  DatasetQualityReport,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetStructure,
  DatasetReplacementResult,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
  FileArrivalApproval,
  FileArrivalItem,
  FileArrivalReplacementResult,
  FileArrivalState,
  DemoWorkspaceId,
  DemoWorkspaceImportResult,
  DerivedDatasetCreateInput,
  DerivedDatasetLineage,
  DerivedDatasetMaterializationResult,
  DerivedDependencyPlan,
  DerivedRecomputeEvent,
  DataCleanPreviewRequest,
  DataCleanOperation,
  DataCleanProposal,
  DataCleanQualityRule,
  DatasetValidationSaveInput,
  DatasetRelationship,
  DatasetRelationshipSaveInput,
  GroupQueryPlanProposal,
  GroupRelationshipOverview,
  GroupQueryRequest,
  GroupQueryPlanExecutionRequest,
  OperationCancellationResult,
  OperationId,
  ProviderConfigurationInput,
  ProviderConnectionResult,
  ProviderId,
  ProviderRegistryState,
  QueryPlanProposal,
  QueryPlanRequest,
  QueryPlanExecutionRequest,
  SafeGroupQueryPlan,
  SafeGroupQueryResult,
  SafeQueryPlan,
  SafeQueryResult,
  WorkflowDefinition,
  WorkflowDefinitionInput,
  WorkflowRun,
  WorkflowTarget,
  WorkflowTrigger,
  WorkflowApprovalDecisionInput,
  WorkflowApprovalRequest,
  ModelAuditEvent,
  McpConnectionConfigurationInput,
  McpConnectionId,
  McpConnectionRegistryState,
  McpExecutableSelection,
  McpInspectionApproval,
  McpInspectionProposal,
  McpInspectionSnapshot,
  McpAuditEvent,
  McpResourceReadApproval,
  McpResourceReadProposal,
  McpResourceReadRequest,
  McpResourceReadResult,
  McpPromptGetApproval,
  McpPromptGetProposal,
  McpPromptGetRequest,
  McpPromptGetResult,
  McpToolCallApproval,
  McpToolCallProposal,
  McpToolCallRequest,
  McpToolCallResult,
  McpPromptModelPreparation,
  McpPromptModelProposal,
  McpPromptModelApproval,
  McpPromptModelAnswer,
  McpModelToolPreparation,
  McpModelToolProposal,
  McpModelToolApproval,
  McpModelToolExecutionProposal,
  RemoteMcpConnectionConfigurationInput,
  RemoteMcpRegistryState,
  RemoteMcpOAuthStartProposal,
  RemoteMcpOAuthApproval,
  RemoteMcpInspectionProposal,
  RemoteMcpInspectionApproval,
  RemoteMcpToolCallProposal,
  RemoteMcpToolCallApproval,
  RemoteMcpAuditEvent,
  WebhookDestinationInput,
  WebhookRegistry,
  WorkflowDeliveryBindingInput,
  WorkflowDeliveryBinding,
  ExternalDeliveryJob,
  HubConnectionInput,
  HubConnectionProfile,
  HubBootstrapRequest,
  HubQueueWorkflowRequest,
  LocalSyncQueueItem,
  LocalSyncedObject,
  LocalSyncedObjectPreview,
  HubAuditPage,
  HubResolveConflictInput,
  HubQueueDeleteInput,
  HubApplyRemoteObjectInput,
  HubAppliedObjectReceipt,
  ArtifactTableActionInput,
  ArtifactCopyResult,
  ArtifactExportResult,
  ProductMetricInput,
  PromptTemplate,
  PromptTemplateRegistry,
  PromptTemplateScope,
  ReconciliationPreviewRequest,
  ReconciliationProposal,
  ReconciliationArtifact,
  ReconciliationDefinition,
  ReconciliationReplayEvent,
  ReportBundleExportResult,
  ReportBundleInput,
  PrivacyPolicy,
  PrivacyTextInspection,
  AgentDefinition,
  AgentDefinitionId,
  AgentDefinitionRegistry,
  AgentDefinitionSaveInput,
  PortableRendererPreferences,
  VisualizationPreference,
  ConfigurationBackupSelectionResult,
  ConfigurationRestoreSelectionResult,
  ConfigurationRestoreFinalization,
} from "@bubu/contracts";

export { parsePromptTemplate, parsePromptTemplateRegistry, parsePortableRendererPreferences } from "@bubu/contracts";

export const desktopChannels = {
  getReadiness: "bubu:system:get-readiness",
  importDatasets: "bubu:datasets:import",
  importDemoWorkspace: "bubu:datasets:import-demo",
  materializeDerivedDataset: "bubu:datasets:materialize-derived",
  prepareDataClean: "bubu:datasets:prepare-data-clean",
  approveDataClean: "bubu:datasets:approve-data-clean",
  dismissDataClean: "bubu:datasets:dismiss-data-clean",
  prepareReconciliation: "bubu:reconciliation:prepare",
  approveReconciliation: "bubu:reconciliation:approve",
  dismissReconciliation: "bubu:reconciliation:dismiss",
  getReconciliationArtifact: "bubu:reconciliation:artifact-get",
  saveReconciliationDefinition: "bubu:reconciliation:definition-save",
  listReconciliationArtifacts: "bubu:reconciliation:artifacts-list",
  listReconciliationReplayEvents: "bubu:reconciliation:replay-events",
  retryReconciliationReplayEvent: "bubu:reconciliation:replay-retry",
  cancelReconciliationReplayEvent: "bubu:reconciliation:replay-cancel",
  recomputeDerivedDataset: "bubu:datasets:recompute-derived",
  getDerivedDatasetLineage: "bubu:datasets:get-derived-lineage",
  getDerivedDependencyPlan: "bubu:datasets:get-derived-dependencies",
  listDerivedRecomputeEvents: "bubu:datasets:list-derived-recomputes",
  retryDerivedRecomputeEvent: "bubu:datasets:retry-derived-recompute",
  cancelDerivedRecomputeEvent: "bubu:datasets:cancel-derived-recompute",
  renameDataset: "bubu:datasets:rename",
  listDatasetVersions: "bubu:datasets:versions-list",
  exportDataset: "bubu:datasets:export",
  deleteDataset: "bubu:datasets:delete",
  createBackup: "bubu:data-protection:create-backup",
  restoreBackup: "bubu:data-protection:restore-backup",
  createConfigurationBackup: "bubu:data-protection:create-configuration-backup",
  restoreConfigurationBackup: "bubu:data-protection:restore-configuration-backup",
  finalizeConfigurationRestore: "bubu:data-protection:finalize-configuration-restore",
  cancelOperation: "bubu:operations:cancel",
  listDatasets: "bubu:datasets:list",
  getDatasetStructure: "bubu:datasets:get-structure",
  previewDataset: "bubu:datasets:preview",
  replaceDataset: "bubu:datasets:replace",
  applyReplacementMapping: "bubu:datasets:apply-replacement-mapping",
  configureFileArrivals: "bubu:file-arrivals:configure",
  listFileArrivals: "bubu:file-arrivals:list",
  approveFileArrival: "bubu:file-arrivals:approve",
  dismissFileArrival: "bubu:file-arrivals:dismiss",
  getDatasetQuality: "bubu:datasets:get-quality",
  getColumnDistribution: "bubu:datasets:get-column-distribution",
  saveDatasetValidation: "bubu:datasets:save-validation",
  listProviders: "bubu:providers:list",
  saveProvider: "bubu:providers:save",
  selectProvider: "bubu:providers:select",
  removeProvider: "bubu:providers:remove",
  testProvider: "bubu:providers:test",
  listMcpConnections: "bubu:mcp:list",
  selectMcpExecutable: "bubu:mcp:select-executable",
  saveMcpConnection: "bubu:mcp:save",
  removeMcpConnection: "bubu:mcp:remove",
  prepareMcpInspection: "bubu:mcp:prepare-inspection",
  approveMcpInspection: "bubu:mcp:approve-inspection",
  dismissMcpInspection: "bubu:mcp:dismiss-inspection",
  listMcpAudits: "bubu:mcp:audits-list",
  prepareMcpResourceRead: "bubu:mcp:prepare-resource-read",
  approveMcpResourceRead: "bubu:mcp:approve-resource-read",
  dismissMcpResourceRead: "bubu:mcp:dismiss-resource-read",
  prepareMcpPromptGet: "bubu:mcp:prepare-prompt-get",
  approveMcpPromptGet: "bubu:mcp:approve-prompt-get",
  dismissMcpPromptGet: "bubu:mcp:dismiss-prompt-get",
  prepareMcpToolCall: "bubu:mcp:prepare-tool-call",
  approveMcpToolCall: "bubu:mcp:approve-tool-call",
  dismissMcpToolCall: "bubu:mcp:dismiss-tool-call",
  prepareMcpPromptModel: "bubu:mcp:prepare-prompt-model",
  approveMcpPromptModel: "bubu:mcp:approve-prompt-model",
  prepareMcpModelTool: "bubu:mcp:prepare-model-tool",
  approveMcpModelTool: "bubu:mcp:approve-model-tool",
  executeMcpModelTool: "bubu:mcp:execute-model-tool",
  dismissMcpModel: "bubu:mcp:dismiss-model",
  listRemoteMcp: "bubu:mcp-remote:list",
  listRemoteMcpAudits: "bubu:mcp-remote:audits-list",
  saveRemoteMcp: "bubu:mcp-remote:save",
  removeRemoteMcp: "bubu:mcp-remote:remove",
  prepareRemoteMcpOAuth: "bubu:mcp-remote:prepare-oauth",
  approveRemoteMcpOAuth: "bubu:mcp-remote:approve-oauth",
  revokeRemoteMcpOAuth: "bubu:mcp-remote:revoke-oauth",
  refreshRemoteMcpOAuth: "bubu:mcp-remote:refresh-oauth",
  prepareRemoteMcpInspection: "bubu:mcp-remote:prepare-inspection",
  approveRemoteMcpInspection: "bubu:mcp-remote:approve-inspection",
  dismissRemoteMcpInspection: "bubu:mcp-remote:dismiss-inspection",
  prepareRemoteMcpTool: "bubu:mcp-remote:prepare-tool",
  approveRemoteMcpTool: "bubu:mcp-remote:approve-tool",
  dismissRemoteMcpTool: "bubu:mcp-remote:dismiss-tool",
  proposeQueryPlan: "bubu:analysis:propose-query-plan",
  executeQueryPlan: "bubu:analysis:execute-query-plan",
  listDatasetGroups: "bubu:dataset-groups:list",
  saveDatasetGroup: "bubu:dataset-groups:save",
  removeDatasetGroup: "bubu:dataset-groups:remove",
  proposeGroupQueryPlan: "bubu:analysis:propose-group-query-plan",
  executeGroupQueryPlan: "bubu:analysis:execute-group-query-plan",
  prepareAggregateExplanation: "bubu:analysis:prepare-aggregate-explanation",
  approveAggregateExplanation: "bubu:analysis:approve-aggregate-explanation",
  dismissAggregateExplanation: "bubu:analysis:dismiss-aggregate-explanation",
  prepareAggregateAgent: "bubu:analysis:prepare-aggregate-agent",
  approveAggregateAgent: "bubu:analysis:approve-aggregate-agent",
  dismissAggregateAgent: "bubu:analysis:dismiss-aggregate-agent",
  prepareExplicitRowDisclosure: "bubu:analysis:prepare-explicit-row-disclosure",
  approveExplicitRowDisclosure: "bubu:analysis:approve-explicit-row-disclosure",
  dismissExplicitRowDisclosure: "bubu:analysis:dismiss-explicit-row-disclosure",
  importKnowledgeSource: "bubu:knowledge:source-import",
  listKnowledgeSources: "bubu:knowledge:source-list",
  rebuildKnowledgeSource: "bubu:knowledge:source-rebuild",
  deleteKnowledgeSource: "bubu:knowledge:source-delete",
  searchKnowledge: "bubu:knowledge:search",
  prepareKnowledgeAnswer: "bubu:knowledge:answer-prepare",
  approveKnowledgeAnswer: "bubu:knowledge:answer-approve",
  dismissKnowledgeAnswer: "bubu:knowledge:answer-dismiss",
  getConversation: "bubu:conversations:get",
  getConversationById: "bubu:conversations:get-by-id",
  pageConversationEntries: "bubu:conversations:entries-page",
  listConversations: "bubu:conversations:list",
  createConversation: "bubu:conversations:create",
  renameConversation: "bubu:conversations:rename",
  archiveConversation: "bubu:conversations:archive",
  deleteConversation: "bubu:conversations:delete",
  getConversationRetentionPolicy: "bubu:conversations:retention-get",
  saveConversationRetentionPolicy: "bubu:conversations:retention-save",
  getGroupRelationships: "bubu:relationships:group-overview",
  saveDatasetRelationship: "bubu:relationships:save",
  removeDatasetRelationship: "bubu:relationships:remove",
  saveWorkflow: "bubu:workflows:save",
  listWorkflows: "bubu:workflows:list",
  deleteWorkflow: "bubu:workflows:delete",
  runWorkflow: "bubu:workflows:run",
  listWorkflowRuns: "bubu:workflows:runs-list",
  listWorkflowApprovals: "bubu:workflows:approvals-list",
  decideWorkflowApproval: "bubu:workflows:approval-decide",
  listWebhookDestinations: "bubu:delivery:webhooks-list",
  saveWebhookDestination: "bubu:delivery:webhooks-save",
  removeWebhookDestination: "bubu:delivery:webhooks-remove",
  listWorkflowDeliveryBindings: "bubu:delivery:bindings-list",
  bindWorkflowDelivery: "bubu:delivery:bindings-save",
  unbindWorkflowDelivery: "bubu:delivery:bindings-remove",
  testWebhookDestination: "bubu:delivery:webhook-test",
  listExternalDeliveryJobs: "bubu:delivery:jobs-list",
  getHubProfile: "bubu:hub:profile-get",
  configureHub: "bubu:hub:configure",
  bootstrapHub: "bubu:hub:bootstrap",
  disconnectHub: "bubu:hub:disconnect",
  queueHubWorkflow: "bubu:hub:workflow-queue",
  listHubQueue: "bubu:hub:queue-list",
  deleteHubObject: "bubu:hub:object-delete",
  resolveHubConflict: "bubu:hub:conflict-resolve",
  flushHubQueue: "bubu:hub:queue-flush",
  pullHubObjects: "bubu:hub:objects-pull",
  listHubObjects: "bubu:hub:objects-list",
  inspectHubObject: "bubu:hub:object-inspect",
  applyHubObject: "bubu:hub:object-apply",
  listHubApplications: "bubu:hub:applications-list",
  getHubAudit: "bubu:hub:audit-get",
  listModelAudits: "bubu:privacy:model-audits-list",
  copyArtifactTable: "bubu:artifacts:copy-table",
  exportArtifactTable: "bubu:artifacts:export-table",
  exportArtifactReport: "bubu:artifacts:export-report",
  recordProductMetric: "bubu:metrics:record",
  getPrivacyPolicy: "bubu:privacy-policy:get",
  savePrivacyPolicy: "bubu:privacy-policy:save",
  inspectPrivacyText: "bubu:privacy-policy:inspect-text",
  listAgentDefinitions: "bubu:agent-definitions:list",
  saveAgentDefinition: "bubu:agent-definitions:save",
  removeAgentDefinition: "bubu:agent-definitions:remove",
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
    importFiles(operationId: OperationId): Promise<DatasetImportResult>;
    importDemo(demoId: DemoWorkspaceId, operationId: OperationId): Promise<DemoWorkspaceImportResult>;
    materializeDerived(input: DerivedDatasetCreateInput, operationId: OperationId): Promise<DerivedDatasetMaterializationResult>;
    prepareDataClean(input: DataCleanPreviewRequest, operationId: OperationId): Promise<DataCleanProposal>;
    approveDataClean(approvalToken: string, operationId: OperationId): Promise<DerivedDatasetMaterializationResult>;
    dismissDataClean(approvalToken: string): Promise<void>;
    recomputeDerived(datasetId: string, operationId: OperationId): Promise<DerivedDatasetMaterializationResult>;
    lineage(datasetId: string): Promise<DerivedDatasetLineage | null>;
    dependencies(datasetId: string): Promise<DerivedDependencyPlan>;
    recomputeEvents(datasetId: string): Promise<readonly DerivedRecomputeEvent[]>;
    retryRecompute(eventId: string): Promise<DerivedRecomputeEvent>;
    cancelRecompute(eventId: string): Promise<DerivedRecomputeEvent>;
    rename(input: DatasetRenameInput): Promise<DatasetSummary>;
    versions(datasetId: string): Promise<readonly DatasetVersionSummary[]>;
    export(datasetId: string, operationId: OperationId): Promise<DatasetExportSelectionResult>;
    delete(datasetId: string): Promise<DatasetDeletionSelectionResult>;
    list(): Promise<readonly DatasetSummary[]>;
    structure(datasetId: string): Promise<DatasetStructure>;
    preview(request: DatasetPreviewRequest): Promise<DatasetPreview>;
    replace(datasetId: string, operationId: OperationId): Promise<DatasetReplacementSelectionResult>;
    applyReplacementMapping(value: DatasetReplacementMappingInput, operationId: OperationId): Promise<DatasetReplacementResult>;
    quality(datasetId: string): Promise<DatasetQualityReport>;
    distribution(value: ColumnDistributionRequest, operationId: OperationId): Promise<ColumnDistribution>;
    saveValidation(value: DatasetValidationSaveInput): Promise<DatasetQualityReport>;
  };
  readonly fileArrivals: {
    configure(): Promise<FileArrivalState>;
    list(): Promise<FileArrivalState>;
    approve(value: FileArrivalApproval, operationId: OperationId): Promise<FileArrivalReplacementResult>;
    dismiss(arrivalId: string): Promise<FileArrivalState>;
  };
  readonly providers: {
    list(): Promise<ProviderRegistryState>;
    save(value: ProviderConfigurationInput): Promise<ProviderRegistryState>;
    select(providerId: ProviderId): Promise<ProviderRegistryState>;
    remove(providerId: ProviderId): Promise<ProviderRegistryState>;
    test(providerId: ProviderId, operationId: OperationId): Promise<ProviderConnectionResult>;
  };
  readonly reconciliation: {
    prepare(input: ReconciliationPreviewRequest, operationId: OperationId): Promise<ReconciliationProposal>;
    approve(approvalToken: string, operationId: OperationId): Promise<ReconciliationArtifact>;
    dismiss(approvalToken: string): Promise<void>;
    artifact(id: string): Promise<ReconciliationArtifact>;
    saveDefinition(artifactId: string): Promise<ReconciliationDefinition>;
    artifacts(datasetIds: readonly string[]): Promise<readonly ReconciliationArtifact[]>;
    replayEvents(datasetIds: readonly string[]): Promise<readonly ReconciliationReplayEvent[]>;
    retryReplay(eventId: string): Promise<ReconciliationReplayEvent>;
    cancelReplay(eventId: string): Promise<ReconciliationReplayEvent>;
  };
  readonly mcp: {
    list(): Promise<McpConnectionRegistryState>;
    selectExecutable(): Promise<McpExecutableSelection>;
    save(value: McpConnectionConfigurationInput): Promise<McpConnectionRegistryState>;
    remove(connectionId: McpConnectionId): Promise<McpConnectionRegistryState>;
    prepareInspection(connectionId: McpConnectionId): Promise<McpInspectionProposal>;
    approveInspection(value: McpInspectionApproval, operationId: OperationId): Promise<McpInspectionSnapshot>;
    dismissInspection(value: McpInspectionApproval): Promise<void>;
    listAudits(): Promise<readonly McpAuditEvent[]>;
    prepareResourceRead(value: McpResourceReadRequest): Promise<McpResourceReadProposal>;
    approveResourceRead(value: McpResourceReadApproval, operationId: OperationId): Promise<McpResourceReadResult>;
    dismissResourceRead(value: McpResourceReadApproval): Promise<void>;
    preparePromptGet(value: McpPromptGetRequest): Promise<McpPromptGetProposal>;
    approvePromptGet(value: McpPromptGetApproval, operationId: OperationId): Promise<McpPromptGetResult>;
    dismissPromptGet(value: McpPromptGetApproval): Promise<void>;
    prepareToolCall(value: McpToolCallRequest): Promise<McpToolCallProposal>;
    approveToolCall(value: McpToolCallApproval, operationId: OperationId): Promise<McpToolCallResult>;
    dismissToolCall(value: McpToolCallApproval): Promise<void>;
    preparePromptModel(value: McpPromptModelPreparation): Promise<McpPromptModelProposal>;
    approvePromptModel(value: McpPromptModelApproval, operationId: OperationId): Promise<McpPromptModelAnswer>;
    prepareModelTool(value: McpModelToolPreparation): Promise<McpModelToolProposal>;
    approveModelTool(value: McpModelToolApproval, operationId: OperationId): Promise<McpModelToolExecutionProposal>;
    executeModelTool(value: McpToolCallApproval, operationId: OperationId): Promise<McpToolCallResult>;
    dismissModel(value: McpPromptModelApproval | McpModelToolApproval): Promise<void>;
  };
  readonly remoteMcp: {
    list(): Promise<RemoteMcpRegistryState>;
    listAudits(): Promise<readonly RemoteMcpAuditEvent[]>;
    save(value: RemoteMcpConnectionConfigurationInput): Promise<RemoteMcpRegistryState>;
    remove(connectionId: string): Promise<RemoteMcpRegistryState>;
    prepareOAuth(connectionId: string): Promise<RemoteMcpOAuthStartProposal>;
    approveOAuth(value: RemoteMcpOAuthApproval, operationId: OperationId): Promise<RemoteMcpRegistryState>;
    revokeOAuth(connectionId: string): Promise<RemoteMcpRegistryState>;
    refreshOAuth(connectionId: string): Promise<RemoteMcpRegistryState>;
    prepareInspection(connectionId: string): Promise<RemoteMcpInspectionProposal>;
    approveInspection(value: RemoteMcpInspectionApproval, operationId: OperationId): Promise<McpInspectionSnapshot>;
    dismissInspection(value: RemoteMcpInspectionApproval): Promise<void>;
    prepareTool(value: McpToolCallRequest): Promise<RemoteMcpToolCallProposal>;
    approveTool(value: RemoteMcpToolCallApproval, operationId: OperationId): Promise<McpToolCallResult>;
    dismissTool(value: RemoteMcpToolCallApproval): Promise<void>;
  };
  readonly dataProtection: {
    createBackup(operationId: OperationId): Promise<DataBackupSelectionResult>;
    restoreBackup(operationId: OperationId): Promise<DataRestoreSelectionResult>;
    createConfigurationBackup(value: PortableRendererPreferences): Promise<ConfigurationBackupSelectionResult>;
    restoreConfigurationBackup(): Promise<ConfigurationRestoreSelectionResult>;
    finalizeConfigurationRestore(value: ConfigurationRestoreFinalization): Promise<void>;
  };
  readonly knowledge: {
    importSource(): Promise<KnowledgeSource | null>;
    listSources(): Promise<readonly KnowledgeSource[]>;
    rebuildSource(sourceId: string): Promise<KnowledgeSource>;
    deleteSource(sourceId: string): Promise<void>;
    search(value: KnowledgeSearchInput): Promise<KnowledgeSearchResult>;
    prepareAnswer(value: KnowledgeDisclosurePreparation): Promise<KnowledgeDisclosureProposal>;
    approveAnswer(value: KnowledgeDisclosureApproval, operationId: OperationId): Promise<KnowledgeAnswer>;
    dismissAnswer(value: KnowledgeDisclosureApproval): Promise<void>;
  };
  readonly privacyPolicy: {
    get(): Promise<PrivacyPolicy>;
    save(value: PrivacyPolicy): Promise<PrivacyPolicy>;
    inspectText(value: string): Promise<PrivacyTextInspection>;
  };
  readonly agentDefinitions: {
    list(): Promise<AgentDefinitionRegistry>;
    save(value: AgentDefinitionSaveInput): Promise<AgentDefinition>;
    remove(id: AgentDefinitionId): Promise<AgentDefinitionRegistry>;
  };
  readonly operations: {
    cancel(operationId: OperationId): Promise<OperationCancellationResult>;
  };
  readonly artifacts: {
    copyTable(value: ArtifactTableActionInput): Promise<ArtifactCopyResult>;
    exportTable(value: ArtifactTableActionInput): Promise<ArtifactExportResult>;
    exportReport(value: ReportBundleInput): Promise<ReportBundleExportResult>;
  };
  readonly metrics: {
    record(value: ProductMetricInput): Promise<void>;
  };
  readonly analysis: {
    propose(value: QueryPlanRequest, operationId: OperationId): Promise<QueryPlanProposal>;
    execute(value: QueryPlanExecutionRequest, operationId: OperationId): Promise<SafeQueryResult>;
    proposeGroup(value: GroupQueryRequest, operationId: OperationId): Promise<GroupQueryPlanProposal>;
    executeGroup(value: GroupQueryPlanExecutionRequest, operationId: OperationId): Promise<SafeGroupQueryResult>;
    prepareAggregateExplanation(value: AggregateExplanationPreparation): Promise<AggregateExplanationProposal>;
    approveAggregateExplanation(value: AggregateExplanationApproval, operationId: OperationId): Promise<AggregateExplanation>;
    dismissAggregateExplanation(value: AggregateExplanationApproval): Promise<void>;
    prepareAggregateAgent(value: AggregateAgentPreparation): Promise<AggregateAgentProposal>;
    approveAggregateAgent(value: AggregateAgentApproval, operationId: OperationId): Promise<AggregateAgentRun>;
    dismissAggregateAgent(value: AggregateAgentApproval): Promise<void>;
    prepareExplicitRowDisclosure(value: ExplicitRowDisclosureSelection): Promise<ExplicitRowDisclosureProposal>;
    approveExplicitRowDisclosure(value: ExplicitRowDisclosureApproval, operationId: OperationId): Promise<ExplicitRowExplanation>;
    dismissExplicitRowDisclosure(value: ExplicitRowDisclosureApproval): Promise<void>;
  };
  readonly datasetGroups: {
    list(): Promise<readonly DatasetGroup[]>;
    save(value: DatasetGroupSaveInput): Promise<DatasetGroup>;
    remove(groupId: DatasetGroupId): Promise<readonly DatasetGroup[]>;
  };
  readonly conversations: {
    get(target: ConversationTarget): Promise<ConversationThread | null>;
    getById(threadId: string): Promise<ConversationThread | null>;
    page(request: ConversationEntryPageRequest): Promise<ConversationEntryPage>;
    list(target: ConversationTarget, archived?: boolean): Promise<readonly ConversationThreadSummary[]>;
    create(input: ConversationCreateInput): Promise<ConversationThread>;
    rename(input: ConversationRenameInput): Promise<ConversationThread>;
    archive(input: ConversationArchiveInput): Promise<void>;
    delete(input: ConversationDeleteInput): Promise<ConversationDeletionResult>;
    retentionPolicy(): Promise<ConversationRetentionPolicy>;
    saveRetentionPolicy(policy: ConversationRetentionPolicy): Promise<ConversationRetentionPolicy>;
  };
  readonly datasetRelationships: {
    overview(groupId: DatasetGroupId): Promise<GroupRelationshipOverview>;
    save(value: DatasetRelationshipSaveInput): Promise<DatasetRelationship>;
    remove(relationshipId: string): Promise<void>;
  };
  readonly workflows: {
    save(value: WorkflowDefinitionInput): Promise<WorkflowDefinition>;
    list(target: WorkflowTarget): Promise<readonly WorkflowDefinition[]>;
    delete(workflowId: string): Promise<void>;
    run(workflowId: string, operationId: OperationId): Promise<WorkflowRun>;
    runs(workflowId: string): Promise<readonly WorkflowRun[]>;
    approvals(): Promise<readonly WorkflowApprovalRequest[]>;
    decideApproval(input: WorkflowApprovalDecisionInput): Promise<WorkflowRun>;
  };
  readonly externalDelivery: {
    listDestinations(): Promise<WebhookRegistry>;
    saveDestination(value: WebhookDestinationInput): Promise<WebhookRegistry>;
    removeDestination(destinationId: string): Promise<WebhookRegistry>;
    listBindings(): Promise<readonly WorkflowDeliveryBinding[]>;
    bind(value: WorkflowDeliveryBindingInput): Promise<readonly WorkflowDeliveryBinding[]>;
    unbind(workflowId: string): Promise<readonly WorkflowDeliveryBinding[]>;
    test(destinationId: string): Promise<ExternalDeliveryJob>;
    jobs(): Promise<readonly ExternalDeliveryJob[]>;
  };
  readonly hub: {
    profile(): Promise<HubConnectionProfile | null>;
    configure(value: HubConnectionInput): Promise<HubConnectionProfile>;
    bootstrap(value: HubBootstrapRequest): Promise<HubConnectionProfile>;
    disconnect(): Promise<void>;
    queueWorkflow(value: HubQueueWorkflowRequest): Promise<LocalSyncQueueItem>;
    queue(): Promise<readonly LocalSyncQueueItem[]>;
    deleteObject(value: HubQueueDeleteInput): Promise<LocalSyncQueueItem>;
    resolveConflict(value: HubResolveConflictInput): Promise<LocalSyncQueueItem>;
    flush(): Promise<readonly LocalSyncQueueItem[]>;
    pull(): Promise<readonly LocalSyncedObject[]>;
    objects(): Promise<readonly LocalSyncedObject[]>;
    inspect(objectId: string, version: number): Promise<LocalSyncedObjectPreview>;
    apply(value: HubApplyRemoteObjectInput): Promise<HubAppliedObjectReceipt>;
    applications(): Promise<readonly HubAppliedObjectReceipt[]>;
    audit(): Promise<{ readonly page: HubAuditPage; readonly verified: boolean }>;
  };
  readonly privacy: {
    listModelAudits(): Promise<readonly ModelAuditEvent[]>;
  };
}

export type {
  AggregateAgentApproval,
  AggregateAgentBudget,
  AggregateAgentPreparation,
  AggregateAgentProposal,
  AggregateAgentRun,
  AggregateAgentToolObservation,
  AggregateDisclosure,
  AggregateExplanation,
  AggregateExplanationApproval,
  AggregateExplanationPreparation,
  AggregateExplanationProposal,
  ExplicitRowDisclosureSelection,
  ExplicitRowDisclosureProposal,
  ExplicitRowDisclosureApproval,
  ExplicitRowExplanation,
  KnowledgeSource,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  KnowledgeDisclosurePreparation,
  KnowledgeDisclosureProposal,
  KnowledgeDisclosureApproval,
  KnowledgeAnswer,
  ColumnProfile,
  ColumnDistribution,
  ColumnDistributionRequest,
  ConversationEntry,
  DataBackupSelectionResult,
  DataRestoreSelectionResult,
  ConversationTarget,
  ConversationCreateInput,
  ConversationRenameInput,
  ConversationArchiveInput,
  ConversationDeleteInput,
  ConversationDeletionResult,
  ConversationRetentionPolicy,
  ConversationThread,
  ConversationThreadSummary,
  ConversationEntryPage,
  ConversationEntryPageRequest,
  DatasetGroup,
  DatasetGroupCadence,
  DatasetGroupId,
  DatasetGroupSaveInput,
  DatasetImportResult,
  DatasetRenameInput,
  DatasetVersionSummary,
  DatasetExportSelectionResult,
  DatasetDeletionSelectionResult,
  DatasetQualityReport,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetStructure,
  DatasetReplacementResult,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
  DemoWorkspaceId,
  DemoWorkspaceImportResult,
  DerivedDatasetCreateInput,
  DerivedDatasetLineage,
  DerivedDatasetMaterializationResult,
  DerivedDependencyPlan,
  DerivedRecomputeEvent,
  DataCleanPreviewRequest,
  DataCleanOperation,
  DataCleanProposal,
  DataCleanQualityRule,
  DatasetValidationSaveInput,
  DatasetRelationship,
  DatasetRelationshipSaveInput,
  GroupQueryPlanProposal,
  GroupRelationshipOverview,
  GroupQueryRequest,
  GroupQueryPlanExecutionRequest,
  OperationCancellationResult,
  OperationId,
  ProviderConfigurationInput,
  ProviderConnectionResult,
  ProviderId,
  ProviderKind,
  ProviderProfile,
  ProviderRegistryState,
  ProviderSummary,
  QueryPlanProposal,
  QueryPlanRequest,
  QueryPlanExecutionRequest,
  SafeGroupQueryPlan,
  SafeGroupQueryResult,
  SafeQueryPlan,
  SafeQueryResult,
  SchemaDrift,
  ValidationRule,
  WorkflowDefinition,
  WorkflowDefinitionInput,
  WorkflowRun,
  WorkflowStepDefinition,
  WorkflowTarget,
  WorkflowTrigger,
  WorkflowApprovalDecisionInput,
  WorkflowApprovalRequest,
  WebhookDestinationInput,
  WebhookRegistry,
  WorkflowDeliveryBindingInput,
  WorkflowDeliveryBinding,
  ExternalDeliveryJob,
  HubConnectionInput,
  HubConnectionProfile,
  HubBootstrapRequest,
  HubQueueWorkflowRequest,
  LocalSyncQueueItem,
  LocalSyncedObject,
  LocalSyncedObjectPreview,
  HubAuditPage,
  HubResolveConflictInput,
  HubQueueDeleteInput,
  HubApplyRemoteObjectInput,
  HubAppliedObjectReceipt,
  ModelAuditEvent,
  McpConnectionConfigurationInput,
  McpConnectionId,
  McpConnectionProfile,
  McpConnectionRegistryState,
  McpExecutableSelection,
  McpInspectionApproval,
  McpInspectionProposal,
  McpInspectionSnapshot,
  McpAuditEvent,
  McpResourceReadApproval,
  McpResourceReadProposal,
  McpResourceReadRequest,
  McpResourceReadResult,
  McpPromptGetApproval,
  McpPromptGetProposal,
  McpPromptGetRequest,
  McpPromptGetResult,
  McpToolCallApproval,
  McpToolCallProposal,
  McpToolCallRequest,
  McpToolCallResult,
  McpPromptModelPreparation,
  McpPromptModelProposal,
  McpPromptModelApproval,
  McpPromptModelAnswer,
  McpModelToolPreparation,
  McpModelToolProposal,
  McpModelToolApproval,
  McpModelToolExecutionProposal,
  RemoteMcpConnectionConfigurationInput,
  RemoteMcpConnectionProfile,
  RemoteMcpRegistryState,
  RemoteMcpOAuthStartProposal,
  RemoteMcpOAuthApproval,
  RemoteMcpInspectionProposal,
  RemoteMcpInspectionApproval,
  RemoteMcpToolCallProposal,
  RemoteMcpToolCallApproval,
  RemoteMcpAuditEvent,
  RelationshipCandidate,
  RelationshipEndpoint,
  RelationshipHint,
  ArtifactTableActionInput,
  ArtifactCopyResult,
  ArtifactExportResult,
  ProductMetricInput,
  PromptTemplate,
  PromptTemplateRegistry,
  PromptTemplateScope,
  ReconciliationPlan,
  ReconciliationPreview,
  ReconciliationPreviewRequest,
  ReconciliationProposal,
  ReconciliationArtifact,
  ReconciliationDefinition,
  ReconciliationReplayEvent,
  ReportBundleExportResult,
  ReportBundleInput,
  FileArrivalApproval,
  FileArrivalItem,
  FileArrivalReplacementResult,
  FileArrivalState,
  PrivacyPolicy,
  PrivacyTextInspection,
  AgentDefinition,
  AgentDefinitionId,
  AgentDefinitionRegistry,
  AgentDefinitionSaveInput,
  PortableRendererPreferences,
  VisualizationPreference,
  ConfigurationBackupSelectionResult,
  ConfigurationRestoreSelectionResult,
  ConfigurationRestoreFinalization,
} from "@bubu/contracts";
