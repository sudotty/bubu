package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func handleLocalKnowledge(ctx context.Context, request Request, datasets DatasetService) (Response, bool) {
	switch request.Method {
	case "knowledge.source.import":
		input, ok := objectParam[data.KnowledgeSourceImportInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be one strict knowledge source import", false), true
		}
		result, err := datasets.ImportKnowledgeSource(ctx, input)
		if err != nil {
			return failure(request.ID, "KNOWLEDGE_IMPORT_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "knowledge.source.list":
		result, err := datasets.ListKnowledgeSources(ctx)
		if err != nil {
			return failure(request.ID, "KNOWLEDGE_LIST_FAILED", err.Error(), true), true
		}
		return success(request.ID, result), true
	case "knowledge.source.rebuild", "knowledge.source.delete":
		id, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "knowledge source id is required", false), true
		}
		if request.Method == "knowledge.source.delete" {
			if err := datasets.DeleteKnowledgeSource(ctx, id); err != nil {
				return failure(request.ID, "KNOWLEDGE_DELETE_REJECTED", err.Error(), false), true
			}
			return success(request.ID, map[string]bool{"deleted": true}), true
		}
		result, err := datasets.RebuildKnowledgeSource(ctx, id)
		if err != nil {
			return failure(request.ID, "KNOWLEDGE_REBUILD_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "knowledge.search":
		input, ok := objectParam[data.KnowledgeSearchInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be one strict bounded knowledge search", false), true
		}
		result, err := datasets.SearchKnowledge(ctx, input)
		if err != nil {
			return failure(request.ID, "KNOWLEDGE_SEARCH_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "knowledge.disclosure.preview":
		purpose, purposeOK := stringParam(request.Params, "purpose")
		result, resultOK := objectParam[data.KnowledgeSearchResult](request.Params, "result")
		if !purposeOK || !resultOK {
			return failure(request.ID, "INVALID_ARGUMENT", "purpose and one strict knowledge search result are required", false), true
		}
		preview, err := datasets.PreviewKnowledgeDisclosure(ctx, purpose, result)
		if err != nil {
			return failure(request.ID, "KNOWLEDGE_DISCLOSURE_REJECTED", err.Error(), false), true
		}
		return success(request.ID, preview), true
	default:
		return Response{}, false
	}
}
