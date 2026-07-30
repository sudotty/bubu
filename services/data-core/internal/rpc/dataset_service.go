package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

// DatasetService is the typed process-boundary surface used by the RPC router.
// Keeping the port separate lets handler.go own decoding and dispatch only.
type DatasetService interface {
	ImportFile(context.Context, string) (data.ImportResult, error)
	ImportFiles(context.Context, []string) (data.ImportResult, error)
	RenameDataset(context.Context, data.DatasetRenameInput) (data.DatasetSummary, error)
	ListDatasetVersions(context.Context, string) ([]data.DatasetVersionSummary, error)
	InspectSource(context.Context, string) (data.SourceInspection, error)
	ReplaceFile(context.Context, string, string) (data.ReplacementResult, error)
	ReplaceFileWithMapping(context.Context, string, string, []data.ColumnMapping) (data.ReplacementResult, error)
	GetQualityReport(context.Context, string) (data.DatasetQualityReport, error)
	SaveValidationRules(context.Context, string, []data.ValidationRule) (data.DatasetQualityReport, error)
	ExportDatasetCSV(context.Context, string, string) (data.DatasetExportResult, error)
	DeleteDataset(context.Context, string) (data.DatasetDeletionResult, error)
	CreateBackup(context.Context, string) (data.DataBackupResult, error)
	RestoreBackup(context.Context, string) (data.DataRestoreResult, error)
	GetColumnDistribution(context.Context, string, string) (data.ColumnDistribution, error)
	ModelContext(context.Context, string, data.DisclosureLevel) (data.ModelContextResult, error)
	ExecuteQueryPlan(context.Context, data.SafeQueryPlan) (data.SafeQueryResult, error)
	ExecuteGroupQueryPlan(context.Context, data.SafeGroupQueryPlan) (data.SafeGroupQueryResult, error)
	MaterializeDerivedDataset(context.Context, data.DerivedDatasetCreateInput) (data.DerivedDatasetMaterializationResult, error)
	PreviewDataCleanPlan(context.Context, data.DataCleanPlan, data.DataCleanQualityPolicy) (data.DataCleanReviewPreview, error)
	PreviewReconciliation(context.Context, data.ReconciliationPlan) (data.ReconciliationPreview, error)
	ExecuteReconciliation(context.Context, data.ReconciliationPlan, data.ReconciliationReview) (data.ReconciliationArtifact, error)
	GetReconciliationArtifact(context.Context, string) (data.ReconciliationArtifact, error)
	SaveReconciliationDefinition(context.Context, string) (data.ReconciliationDefinition, error)
	ListReconciliationArtifacts(context.Context, []string) ([]data.ReconciliationArtifact, error)
	ProcessReconciliationReplayEvents(context.Context) ([]data.ReconciliationReplayEvent, error)
	ListReconciliationReplayEvents(context.Context, []string) ([]data.ReconciliationReplayEvent, error)
	RetryReconciliationReplayEvent(context.Context, string) (data.ReconciliationReplayEvent, error)
	CancelReconciliationReplayEvent(context.Context, string) (data.ReconciliationReplayEvent, error)
	RecomputeDerivedDataset(context.Context, string) (data.DerivedDatasetMaterializationResult, error)
	GetDerivedDatasetLineage(context.Context, string) (*data.DerivedDatasetLineage, error)
	GetDerivedDependencyPlan(context.Context, string) (data.DerivedDependencyPlan, error)
	ProcessDerivedRecomputeEvents(context.Context) ([]data.DerivedRecomputeEvent, error)
	ListDerivedRecomputeEvents(context.Context, string) ([]data.DerivedRecomputeEvent, error)
	RetryDerivedRecomputeEvent(context.Context, string) (data.DerivedRecomputeEvent, error)
	CancelDerivedRecomputeEvent(context.Context, string) (data.DerivedRecomputeEvent, error)
	SaveGroup(context.Context, string, string, string, string, []string) (data.DatasetGroup, error)
	ListGroups(context.Context) ([]data.DatasetGroup, error)
	DeleteGroup(context.Context, string) error
	GetGroupRelationships(context.Context, string) (data.GroupRelationshipOverview, error)
	SaveRelationship(context.Context, data.DatasetRelationshipSaveInput) (data.DatasetRelationship, error)
	DeleteRelationship(context.Context, string) error
	GetConversation(context.Context, data.ConversationTarget) (*data.ConversationThread, error)
	GetConversationByID(context.Context, string) (*data.ConversationThread, error)
	PageConversationEntries(context.Context, string, int, int) (data.ConversationEntryPage, error)
	ListConversations(context.Context, data.ConversationTarget, bool) ([]data.ConversationThreadSummary, error)
	CreateConversation(context.Context, data.ConversationCreateInput) (*data.ConversationThread, error)
	RenameConversation(context.Context, data.ConversationRenameInput) (*data.ConversationThread, error)
	ArchiveConversation(context.Context, data.ConversationArchiveInput) error
	DeleteConversation(context.Context, data.ConversationDeleteInput) (data.ConversationDeletionResult, error)
	ApplyConversationRetention(context.Context, int) (data.ConversationRetentionResult, error)
	AppendConversationEntry(context.Context, data.ConversationAppendInput) (*data.ConversationThread, error)
	ListDatasets(context.Context) ([]data.DatasetSummary, error)
	Preview(context.Context, string, int, int) (data.PreviewResult, error)
	DatasetStructure(context.Context, string) (data.DatasetStructure, error)
	PreviewExplicitRowDisclosure(context.Context, data.ExplicitRowDisclosureSelection) (data.ExplicitRowDisclosurePreview, error)
	ImportKnowledgeSource(context.Context, data.KnowledgeSourceImportInput) (data.KnowledgeSource, error)
	ListKnowledgeSources(context.Context) ([]data.KnowledgeSource, error)
	RebuildKnowledgeSource(context.Context, string) (data.KnowledgeSource, error)
	DeleteKnowledgeSource(context.Context, string) error
	SearchKnowledge(context.Context, data.KnowledgeSearchInput) (data.KnowledgeSearchResult, error)
	PreviewKnowledgeDisclosure(context.Context, string, data.KnowledgeSearchResult) (data.KnowledgeDisclosurePreview, error)
}
