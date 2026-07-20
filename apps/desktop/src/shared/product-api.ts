import type {
  AggregateAgentApproval,
  AggregateAgentPreparation,
  AggregateAgentProposal,
  AggregateAgentRun,
  AggregateExplanation,
  AggregateExplanationApproval,
  AggregateExplanationPreparation,
  AggregateExplanationProposal,
  ConversationTarget,
  ConversationCreateInput,
  ConversationRenameInput,
  ConversationArchiveInput,
  ColumnDistribution,
  ColumnDistributionRequest,
  DataBackupSelectionResult,
  DataRestoreSelectionResult,
  ConversationThread,
  ConversationThreadSummary,
  DatasetGroup,
  DatasetGroupId,
  DatasetGroupSaveInput,
  DatasetImportResult,
  DatasetExportSelectionResult,
  DatasetDeletionSelectionResult,
  DatasetQualityReport,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetReplacementResult,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
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
  ModelAuditEvent,
  McpConnectionConfigurationInput,
  McpConnectionId,
  McpConnectionRegistryState,
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
  ArtifactTableActionInput,
  ArtifactCopyResult,
  ArtifactExportResult,
} from "@bubu/contracts";

export const desktopChannels = {
  getReadiness: "bubu:system:get-readiness",
  importDatasets: "bubu:datasets:import",
  exportDataset: "bubu:datasets:export",
  deleteDataset: "bubu:datasets:delete",
  createBackup: "bubu:data-protection:create-backup",
  restoreBackup: "bubu:data-protection:restore-backup",
  cancelOperation: "bubu:operations:cancel",
  listDatasets: "bubu:datasets:list",
  previewDataset: "bubu:datasets:preview",
  replaceDataset: "bubu:datasets:replace",
  applyReplacementMapping: "bubu:datasets:apply-replacement-mapping",
  getDatasetQuality: "bubu:datasets:get-quality",
  getColumnDistribution: "bubu:datasets:get-column-distribution",
  saveDatasetValidation: "bubu:datasets:save-validation",
  listProviders: "bubu:providers:list",
  saveProvider: "bubu:providers:save",
  selectProvider: "bubu:providers:select",
  removeProvider: "bubu:providers:remove",
  testProvider: "bubu:providers:test",
  listMcpConnections: "bubu:mcp:list",
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
  getConversation: "bubu:conversations:get",
  getConversationById: "bubu:conversations:get-by-id",
  listConversations: "bubu:conversations:list",
  createConversation: "bubu:conversations:create",
  renameConversation: "bubu:conversations:rename",
  archiveConversation: "bubu:conversations:archive",
  getGroupRelationships: "bubu:relationships:group-overview",
  saveDatasetRelationship: "bubu:relationships:save",
  removeDatasetRelationship: "bubu:relationships:remove",
  saveWorkflow: "bubu:workflows:save",
  listWorkflows: "bubu:workflows:list",
  deleteWorkflow: "bubu:workflows:delete",
  runWorkflow: "bubu:workflows:run",
  listWorkflowRuns: "bubu:workflows:runs-list",
  listModelAudits: "bubu:privacy:model-audits-list",
  copyArtifactTable: "bubu:artifacts:copy-table",
  exportArtifactTable: "bubu:artifacts:export-table",
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
    export(datasetId: string, operationId: OperationId): Promise<DatasetExportSelectionResult>;
    delete(datasetId: string): Promise<DatasetDeletionSelectionResult>;
    list(): Promise<readonly DatasetSummary[]>;
    preview(request: DatasetPreviewRequest): Promise<DatasetPreview>;
    replace(datasetId: string, operationId: OperationId): Promise<DatasetReplacementSelectionResult>;
    applyReplacementMapping(value: DatasetReplacementMappingInput, operationId: OperationId): Promise<DatasetReplacementResult>;
    quality(datasetId: string): Promise<DatasetQualityReport>;
    distribution(value: ColumnDistributionRequest, operationId: OperationId): Promise<ColumnDistribution>;
    saveValidation(value: DatasetValidationSaveInput): Promise<DatasetQualityReport>;
  };
  readonly providers: {
    list(): Promise<ProviderRegistryState>;
    save(value: ProviderConfigurationInput): Promise<ProviderRegistryState>;
    select(providerId: ProviderId): Promise<ProviderRegistryState>;
    remove(providerId: ProviderId): Promise<ProviderRegistryState>;
    test(providerId: ProviderId, operationId: OperationId): Promise<ProviderConnectionResult>;
  };
  readonly mcp: {
    list(): Promise<McpConnectionRegistryState>;
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
  };
  readonly dataProtection: {
    createBackup(operationId: OperationId): Promise<DataBackupSelectionResult>;
    restoreBackup(operationId: OperationId): Promise<DataRestoreSelectionResult>;
  };
  readonly operations: {
    cancel(operationId: OperationId): Promise<OperationCancellationResult>;
  };
  readonly artifacts: {
    copyTable(value: ArtifactTableActionInput): Promise<ArtifactCopyResult>;
    exportTable(value: ArtifactTableActionInput): Promise<ArtifactExportResult>;
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
  };
  readonly datasetGroups: {
    list(): Promise<readonly DatasetGroup[]>;
    save(value: DatasetGroupSaveInput): Promise<DatasetGroup>;
    remove(groupId: DatasetGroupId): Promise<readonly DatasetGroup[]>;
  };
  readonly conversations: {
    get(target: ConversationTarget): Promise<ConversationThread | null>;
    getById(threadId: string): Promise<ConversationThread | null>;
    list(target: ConversationTarget, archived?: boolean): Promise<readonly ConversationThreadSummary[]>;
    create(input: ConversationCreateInput): Promise<ConversationThread>;
    rename(input: ConversationRenameInput): Promise<ConversationThread>;
    archive(input: ConversationArchiveInput): Promise<void>;
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
  ConversationThread,
  ConversationThreadSummary,
  DatasetGroup,
  DatasetGroupId,
  DatasetGroupSaveInput,
  DatasetImportResult,
  DatasetExportSelectionResult,
  DatasetDeletionSelectionResult,
  DatasetQualityReport,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetReplacementResult,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
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
  ModelAuditEvent,
  McpConnectionConfigurationInput,
  McpConnectionId,
  McpConnectionProfile,
  McpConnectionRegistryState,
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
  RelationshipCandidate,
  RelationshipEndpoint,
  RelationshipHint,
  ArtifactTableActionInput,
  ArtifactCopyResult,
  ArtifactExportResult,
} from "@bubu/contracts";
