import type {
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
} from "@bubu/contracts";

export const desktopChannels = {
  getReadiness: "bubu:system:get-readiness",
  importDatasets: "bubu:datasets:import",
  exportDataset: "bubu:datasets:export",
  deleteDataset: "bubu:datasets:delete",
  listDatasets: "bubu:datasets:list",
  previewDataset: "bubu:datasets:preview",
  replaceDataset: "bubu:datasets:replace",
  applyReplacementMapping: "bubu:datasets:apply-replacement-mapping",
  getDatasetQuality: "bubu:datasets:get-quality",
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
    importFiles(): Promise<DatasetImportResult>;
    export(datasetId: string): Promise<DatasetExportSelectionResult>;
    delete(datasetId: string): Promise<DatasetDeletionSelectionResult>;
    list(): Promise<readonly DatasetSummary[]>;
    preview(request: DatasetPreviewRequest): Promise<DatasetPreview>;
    replace(datasetId: string): Promise<DatasetReplacementSelectionResult>;
    applyReplacementMapping(value: DatasetReplacementMappingInput): Promise<DatasetReplacementResult>;
    quality(datasetId: string): Promise<DatasetQualityReport>;
    saveValidation(value: DatasetValidationSaveInput): Promise<DatasetQualityReport>;
  };
  readonly providers: {
    list(): Promise<ProviderRegistryState>;
    save(value: ProviderConfigurationInput): Promise<ProviderRegistryState>;
    select(providerId: ProviderId): Promise<ProviderRegistryState>;
    remove(providerId: ProviderId): Promise<ProviderRegistryState>;
    test(providerId: ProviderId): Promise<ProviderConnectionResult>;
  };
  readonly analysis: {
    propose(value: QueryPlanRequest): Promise<QueryPlanProposal>;
    execute(plan: SafeQueryPlan): Promise<SafeQueryResult>;
    proposeGroup(value: GroupQueryRequest): Promise<GroupQueryPlanProposal>;
    executeGroup(plan: SafeGroupQueryPlan): Promise<SafeGroupQueryResult>;
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
}

export type {
  ColumnProfile,
  ConversationEntry,
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
  RelationshipCandidate,
  RelationshipEndpoint,
  RelationshipHint,
} from "@bubu/contracts";
