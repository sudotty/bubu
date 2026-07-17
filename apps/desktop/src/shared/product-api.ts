import type {
  ConversationTarget,
  ColumnDistribution,
  ColumnDistributionRequest,
  DataBackupSelectionResult,
  DataRestoreSelectionResult,
  ConversationThread,
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
  OperationCancellationResult,
  OperationId,
  ProviderConfigurationInput,
  ProviderConnectionResult,
  ProviderId,
  ProviderRegistryState,
  QueryPlanProposal,
  QueryPlanRequest,
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
  proposeQueryPlan: "bubu:analysis:propose-query-plan",
  executeQueryPlan: "bubu:analysis:execute-query-plan",
  listDatasetGroups: "bubu:dataset-groups:list",
  saveDatasetGroup: "bubu:dataset-groups:save",
  removeDatasetGroup: "bubu:dataset-groups:remove",
  proposeGroupQueryPlan: "bubu:analysis:propose-group-query-plan",
  executeGroupQueryPlan: "bubu:analysis:execute-group-query-plan",
  getConversation: "bubu:conversations:get",
  getGroupRelationships: "bubu:relationships:group-overview",
  saveDatasetRelationship: "bubu:relationships:save",
  removeDatasetRelationship: "bubu:relationships:remove",
  saveWorkflow: "bubu:workflows:save",
  listWorkflows: "bubu:workflows:list",
  deleteWorkflow: "bubu:workflows:delete",
  runWorkflow: "bubu:workflows:run",
  listWorkflowRuns: "bubu:workflows:runs-list",
  listModelAudits: "bubu:privacy:model-audits-list",
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
  readonly dataProtection: {
    createBackup(operationId: OperationId): Promise<DataBackupSelectionResult>;
    restoreBackup(operationId: OperationId): Promise<DataRestoreSelectionResult>;
  };
  readonly operations: {
    cancel(operationId: OperationId): Promise<OperationCancellationResult>;
  };
  readonly analysis: {
    propose(value: QueryPlanRequest, operationId: OperationId): Promise<QueryPlanProposal>;
    execute(plan: SafeQueryPlan, operationId: OperationId): Promise<SafeQueryResult>;
    proposeGroup(value: GroupQueryRequest, operationId: OperationId): Promise<GroupQueryPlanProposal>;
    executeGroup(plan: SafeGroupQueryPlan, operationId: OperationId): Promise<SafeGroupQueryResult>;
  };
  readonly datasetGroups: {
    list(): Promise<readonly DatasetGroup[]>;
    save(value: DatasetGroupSaveInput): Promise<DatasetGroup>;
    remove(groupId: DatasetGroupId): Promise<readonly DatasetGroup[]>;
  };
  readonly conversations: {
    get(target: ConversationTarget): Promise<ConversationThread | null>;
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
  ColumnProfile,
  ColumnDistribution,
  ColumnDistributionRequest,
  ConversationEntry,
  DataBackupSelectionResult,
  DataRestoreSelectionResult,
  ConversationTarget,
  ConversationThread,
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
  RelationshipCandidate,
  RelationshipEndpoint,
  RelationshipHint,
} from "@bubu/contracts";
