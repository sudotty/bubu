package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func DecodeRequest(raw []byte) (Request, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var request Request
	if err := decoder.Decode(&request); err != nil {
		return Request{}, fmt.Errorf("decode request: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return Request{}, err
	}
	if request.ProtocolVersion != ProtocolVersion {
		return Request{}, fmt.Errorf("unsupported protocol version: %d", request.ProtocolVersion)
	}
	if len(request.Auth) < 32 {
		return Request{}, errors.New("process credential is missing or too short")
	}
	if strings.TrimSpace(request.ID) == "" || len(request.ID) > 128 {
		return Request{}, errors.New("request id is invalid")
	}
	if strings.TrimSpace(request.Method) == "" {
		return Request{}, errors.New("request method is invalid")
	}
	if request.Params == nil {
		return Request{}, errors.New("request params must be an object")
	}
	return request, nil
}

func ensureJSONEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request contains multiple JSON values")
		}
		return fmt.Errorf("decode trailing data: %w", err)
	}
	return nil
}

type DatasetService interface {
	ImportFile(ctx context.Context, sourcePath string) (data.ImportResult, error)
	ImportFiles(ctx context.Context, sourcePaths []string) (data.ImportResult, error)
	RenameDataset(ctx context.Context, input data.DatasetRenameInput) (data.DatasetSummary, error)
	ListDatasetVersions(ctx context.Context, datasetID string) ([]data.DatasetVersionSummary, error)
	ReplaceFile(ctx context.Context, datasetID string, sourcePath string) (data.ReplacementResult, error)
	ReplaceFileWithMapping(ctx context.Context, datasetID string, sourcePath string, mappings []data.ColumnMapping) (data.ReplacementResult, error)
	GetQualityReport(ctx context.Context, datasetID string) (data.DatasetQualityReport, error)
	SaveValidationRules(ctx context.Context, datasetID string, rules []data.ValidationRule) (data.DatasetQualityReport, error)
	ExportDatasetCSV(ctx context.Context, datasetID string, targetPath string) (data.DatasetExportResult, error)
	DeleteDataset(ctx context.Context, datasetID string) (data.DatasetDeletionResult, error)
	CreateBackup(ctx context.Context, targetPath string) (data.DataBackupResult, error)
	RestoreBackup(ctx context.Context, sourcePath string) (data.DataRestoreResult, error)
	GetColumnDistribution(ctx context.Context, datasetID string, columnName string) (data.ColumnDistribution, error)
	ModelContext(ctx context.Context, datasetID string, disclosure data.DisclosureLevel) (data.ModelContextResult, error)
	ExecuteQueryPlan(ctx context.Context, plan data.SafeQueryPlan) (data.SafeQueryResult, error)
	ExecuteGroupQueryPlan(ctx context.Context, plan data.SafeGroupQueryPlan) (data.SafeGroupQueryResult, error)
	SaveGroup(ctx context.Context, groupID string, name string, description string, cadence string, datasetIDs []string) (data.DatasetGroup, error)
	ListGroups(ctx context.Context) ([]data.DatasetGroup, error)
	DeleteGroup(ctx context.Context, groupID string) error
	GetGroupRelationships(ctx context.Context, groupID string) (data.GroupRelationshipOverview, error)
	SaveRelationship(ctx context.Context, input data.DatasetRelationshipSaveInput) (data.DatasetRelationship, error)
	DeleteRelationship(ctx context.Context, relationshipID string) error
	GetConversation(ctx context.Context, target data.ConversationTarget) (*data.ConversationThread, error)
	GetConversationByID(ctx context.Context, threadID string) (*data.ConversationThread, error)
	ListConversations(ctx context.Context, target data.ConversationTarget, archived bool) ([]data.ConversationThreadSummary, error)
	CreateConversation(ctx context.Context, input data.ConversationCreateInput) (*data.ConversationThread, error)
	RenameConversation(ctx context.Context, input data.ConversationRenameInput) (*data.ConversationThread, error)
	ArchiveConversation(ctx context.Context, input data.ConversationArchiveInput) error
	AppendConversationEntry(ctx context.Context, input data.ConversationAppendInput) (*data.ConversationThread, error)
	ListDatasets(ctx context.Context) ([]data.DatasetSummary, error)
	Preview(ctx context.Context, datasetID string, limit, offset int) (data.PreviewResult, error)
}

func Handle(request Request, expectedAuth string) Response {
	return HandleWithData(context.Background(), request, expectedAuth, nil)
}

func HandleWithData(ctx context.Context, request Request, expectedAuth string, datasets DatasetService) Response {
	if request.Auth != expectedAuth {
		return failure(request.ID, "UNAUTHORIZED", "Invalid process credential", false)
	}

	if request.Method == "system.health" {
		return handleHealth(request, datasets)
	}
	if datasets == nil {
		return failure(request.ID, "METHOD_NOT_FOUND", "Unknown data-core method", false)
	}
	if response, handled := handleExtendedMethods(ctx, request, datasets); handled {
		return response
	}
	if response, handled := handleConversationMethod(ctx, request, datasets); handled {
		return response
	}

	switch request.Method {
	case "dataset.import":
		sourcePath, ok := stringParam(request.Params, "sourcePath")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "sourcePath is required", false)
		}
		result, err := datasets.ImportFile(ctx, sourcePath)
		if err != nil {
			return failure(request.ID, "IMPORT_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.import.batch":
		sourcePaths, ok := stringSliceParam(request.Params, "sourcePaths", 100)
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "sourcePaths must contain between 1 and 100 file paths", false)
		}
		result, err := datasets.ImportFiles(ctx, sourcePaths)
		if err != nil {
			return failure(request.ID, "IMPORT_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.rename":
		input, ok := objectParam[data.DatasetRenameInput](map[string]any{"input": request.Params}, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId and displayName are required", false)
		}
		result, err := datasets.RenameDataset(ctx, input)
		if err != nil {
			return failure(request.ID, "DATASET_RENAME_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.versions.list":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false)
		}
		result, err := datasets.ListDatasetVersions(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DATASET_VERSIONS_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.replace":
		datasetID, datasetOK := stringParam(request.Params, "datasetId")
		sourcePath, pathOK := stringParam(request.Params, "sourcePath")
		if !datasetOK || !pathOK {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId and sourcePath are required", false)
		}
		result, err := datasets.ReplaceFile(ctx, datasetID, sourcePath)
		if err != nil {
			return failure(request.ID, "REPLACEMENT_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.replace.mapped":
		datasetID, datasetOK := stringParam(request.Params, "datasetId")
		sourcePath, pathOK := stringParam(request.Params, "sourcePath")
		mappings, mappingsOK := objectParam[[]data.ColumnMapping](request.Params, "mappings")
		if !datasetOK || !pathOK || !mappingsOK || len(mappings) == 0 || len(mappings) > 500 {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId, sourcePath, and bounded mappings are required", false)
		}
		result, err := datasets.ReplaceFileWithMapping(ctx, datasetID, sourcePath, mappings)
		if err != nil {
			return failure(request.ID, "REPLACEMENT_MAPPING_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.context":
		datasetID, datasetOK := stringParam(request.Params, "datasetId")
		disclosure, disclosureOK := stringParam(request.Params, "disclosure")
		if !datasetOK || !disclosureOK {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId and disclosure are required", false)
		}
		result, err := datasets.ModelContext(ctx, datasetID, data.DisclosureLevel(disclosure))
		if err != nil {
			return failure(request.ID, "CONTEXT_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.quality.get":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false)
		}
		result, err := datasets.GetQualityReport(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "QUALITY_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.validation.save":
		input, ok := objectParam[validationSaveInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must contain a datasetId and strict validation rules", false)
		}
		result, err := datasets.SaveValidationRules(ctx, input.DatasetID, input.Rules)
		if err != nil {
			return failure(request.ID, "VALIDATION_SAVE_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.query.execute":
		plan, ok := objectParam[data.SafeQueryPlan](request.Params, "plan")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "plan must be a strict safe query plan", false)
		}
		result, err := datasets.ExecuteQueryPlan(ctx, plan)
		if err != nil {
			return failure(request.ID, "QUERY_REJECTED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.group.save":
		input, ok := objectParam[data.DatasetGroupSaveInput](map[string]any{"input": request.Params}, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "group name, optional id, and datasetIds are invalid", false)
		}
		if input.Cadence == "" {
			input.Cadence = "one-off"
		}
		if input.Name == "" || len(input.DatasetIDs) < 2 || len(input.DatasetIDs) > 8 || !validGroupCadence(input.Cadence) {
			return failure(request.ID, "INVALID_ARGUMENT", "group name, cadence, and 2-8 datasetIds are required", false)
		}
		result, err := datasets.SaveGroup(ctx, input.ID, input.Name, input.Description, input.Cadence, input.DatasetIDs)
		if err != nil {
			return failure(request.ID, "GROUP_SAVE_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.group.list":
		result, err := datasets.ListGroups(ctx)
		if err != nil {
			return failure(request.ID, "GROUP_ACCESS_FAILED", err.Error(), true)
		}
		return success(request.ID, result)
	case "dataset.group.delete":
		groupID, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "group id is required", false)
		}
		if err := datasets.DeleteGroup(ctx, groupID); err != nil {
			return failure(request.ID, "GROUP_DELETE_FAILED", err.Error(), false)
		}
		return success(request.ID, map[string]bool{"deleted": true})
	case "dataset.group.relationships":
		groupID, ok := stringParam(request.Params, "groupId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "groupId is required", false)
		}
		result, err := datasets.GetGroupRelationships(ctx, groupID)
		if err != nil {
			return failure(request.ID, "RELATIONSHIP_ACCESS_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.relationship.save":
		input, ok := objectParam[data.DatasetRelationshipSaveInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict directional relationship", false)
		}
		result, err := datasets.SaveRelationship(ctx, input)
		if err != nil {
			return failure(request.ID, "RELATIONSHIP_SAVE_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.relationship.delete":
		relationshipID, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "relationship id is required", false)
		}
		if err := datasets.DeleteRelationship(ctx, relationshipID); err != nil {
			return failure(request.ID, "RELATIONSHIP_DELETE_FAILED", err.Error(), false)
		}
		return success(request.ID, map[string]bool{"deleted": true})
	case "dataset.group.query.execute":
		plan, ok := objectParam[data.SafeGroupQueryPlan](request.Params, "plan")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "plan must be a strict safe group query plan", false)
		}
		result, err := datasets.ExecuteGroupQueryPlan(ctx, plan)
		if err != nil {
			return failure(request.ID, "GROUP_QUERY_REJECTED", err.Error(), false)
		}
		return success(request.ID, result)
	case "dataset.list":
		result, err := datasets.ListDatasets(ctx)
		if err != nil {
			return failure(request.ID, "DATA_ACCESS_FAILED", err.Error(), true)
		}
		return success(request.ID, result)
	case "dataset.preview":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false)
		}
		limit, ok := integerParam(request.Params, "limit")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "limit must be an integer", false)
		}
		offset, ok := integerParam(request.Params, "offset")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "offset must be an integer", false)
		}
		result, err := datasets.Preview(ctx, datasetID, limit, offset)
		if err != nil {
			return failure(request.ID, "PREVIEW_FAILED", err.Error(), false)
		}
		return success(request.ID, result)
	}

	return failure(request.ID, "METHOD_NOT_FOUND", "Unknown data-core method", false)
}

func validGroupCadence(value string) bool {
	switch value {
	case "one-off", "daily", "weekly", "monthly", "dataset-version":
		return true
	default:
		return false
	}
}

func stringParam(params map[string]any, key string) (string, bool) {
	value, ok := params[key].(string)
	if !ok || strings.TrimSpace(value) == "" {
		return "", false
	}
	return value, true
}

func success(id string, result any) Response {
	return Response{ProtocolVersion: ProtocolVersion, ID: id, OK: true, Result: result}
}

func failure(id, code, message string, retryable bool) Response {
	return Response{
		ProtocolVersion: ProtocolVersion,
		ID:              id,
		OK:              false,
		Error:           &Error{Code: code, Message: message, Retryable: retryable},
	}
}
