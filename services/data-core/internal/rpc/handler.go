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
	ReplaceFile(ctx context.Context, datasetID string, sourcePath string) (data.ReplacementResult, error)
	ModelContext(ctx context.Context, datasetID string, disclosure data.DisclosureLevel) (data.ModelContextResult, error)
	ExecuteQueryPlan(ctx context.Context, plan data.SafeQueryPlan) (data.SafeQueryResult, error)
	SaveGroup(ctx context.Context, groupID string, name string, datasetIDs []string) (data.DatasetGroup, error)
	ListGroups(ctx context.Context) ([]data.DatasetGroup, error)
	DeleteGroup(ctx context.Context, groupID string) error
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
		capabilities := []string{"local-rpc"}
		if datasets != nil {
			capabilities = []string{
				"sqlite",
				"csv-import",
				"xlsx-import",
				"dataset-catalog",
				"preview",
				"version-replacement",
				"schema-drift",
				"privacy-context",
				"safe-query-plan",
				"dataset-groups",
			}
		}
		return success(request.ID, ServiceHealth{
			Service:         "data-core",
			ProtocolVersion: ProtocolVersion,
			Status:          "ready",
			Capabilities:    capabilities,
		})
	}
	if datasets == nil {
		return failure(request.ID, "METHOD_NOT_FOUND", "Unknown data-core method", false)
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
		name, nameOK := stringParam(request.Params, "name")
		datasetIDs, datasetsOK := stringSliceParam(request.Params, "datasetIds", 8)
		groupID, idOK := optionalStringParam(request.Params, "id")
		if !nameOK || !datasetsOK || !idOK {
			return failure(request.ID, "INVALID_ARGUMENT", "group name, optional id, and datasetIds are invalid", false)
		}
		result, err := datasets.SaveGroup(ctx, groupID, name, datasetIDs)
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

func stringParam(params map[string]any, key string) (string, bool) {
	value, ok := params[key].(string)
	if !ok || strings.TrimSpace(value) == "" {
		return "", false
	}
	return value, true
}

func integerParam(params map[string]any, key string) (int, bool) {
	value, ok := params[key].(float64)
	if !ok || value != float64(int(value)) {
		return 0, false
	}
	return int(value), true
}

func optionalStringParam(params map[string]any, key string) (string, bool) {
	value, exists := params[key]
	if !exists {
		return "", true
	}
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return "", false
	}
	return text, true
}

func stringSliceParam(params map[string]any, key string, maximum int) ([]string, bool) {
	values, ok := params[key].([]any)
	if !ok || len(values) == 0 || len(values) > maximum {
		return nil, false
	}
	result := make([]string, len(values))
	for index, value := range values {
		text, ok := value.(string)
		if !ok || strings.TrimSpace(text) == "" || len(text) > 32*1024 {
			return nil, false
		}
		result[index] = text
	}
	return result, true
}

func objectParam[T any](params map[string]any, key string) (T, bool) {
	var result T
	value, ok := params[key]
	if !ok {
		return result, false
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return result, false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return result, false
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return result, false
	}
	return result, true
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
