package rpc

import (
	"context"
	"strings"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func handleConversationMethod(ctx context.Context, request Request, datasets DatasetService) (Response, bool) {
	if !strings.HasPrefix(request.Method, "conversation.") {
		return Response{}, false
	}
	switch request.Method {
	case "conversation.get":
		target, ok := objectParam[data.ConversationTarget](request.Params, "target")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "target must be a strict conversation target", false), true
		}
		result, err := datasets.GetConversation(ctx, target)
		if err != nil {
			return failure(request.ID, "CONVERSATION_ACCESS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.get.byid":
		threadID, ok := stringParam(request.Params, "threadId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "threadId is required", false), true
		}
		result, err := datasets.GetConversationByID(ctx, threadID)
		if err != nil {
			return failure(request.ID, "CONVERSATION_ACCESS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.entries.page":
		threadID, threadOK := stringParam(request.Params, "threadId")
		beforeOrdinal, beforeOK := integerParam(request.Params, "beforeOrdinal")
		limit, limitOK := integerParam(request.Params, "limit")
		if !threadOK || !beforeOK || !limitOK {
			return failure(request.ID, "INVALID_ARGUMENT", "threadId, beforeOrdinal, and limit are required", false), true
		}
		result, err := datasets.PageConversationEntries(ctx, threadID, beforeOrdinal, limit)
		if err != nil {
			return failure(request.ID, "CONVERSATION_PAGE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.list":
		target, ok := objectParam[data.ConversationTarget](request.Params, "target")
		archived, archivedOK := objectParam[bool](request.Params, "archived")
		if !ok || !archivedOK {
			return failure(request.ID, "INVALID_ARGUMENT", "target must be a strict conversation target", false), true
		}
		result, err := datasets.ListConversations(ctx, target, archived)
		if err != nil {
			return failure(request.ID, "CONVERSATION_ACCESS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.create":
		input, ok := objectParam[data.ConversationCreateInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict conversation creation", false), true
		}
		result, err := datasets.CreateConversation(ctx, input)
		if err != nil {
			return failure(request.ID, "CONVERSATION_CREATE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.rename":
		input, ok := objectParam[data.ConversationRenameInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict conversation rename", false), true
		}
		result, err := datasets.RenameConversation(ctx, input)
		if err != nil {
			return failure(request.ID, "CONVERSATION_RENAME_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.archive":
		input, ok := objectParam[data.ConversationArchiveInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict conversation archive", false), true
		}
		if err := datasets.ArchiveConversation(ctx, input); err != nil {
			return failure(request.ID, "CONVERSATION_ARCHIVE_FAILED", err.Error(), false), true
		}
		return success(request.ID, map[string]bool{"archived": input.Archived}), true
	case "conversation.delete":
		input, ok := objectParam[data.ConversationDeleteInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict conversation deletion", false), true
		}
		result, err := datasets.DeleteConversation(ctx, input)
		if err != nil {
			return failure(request.ID, "CONVERSATION_DELETE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.retention.apply":
		retentionDays, ok := objectParam[int](request.Params, "retentionDays")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "retentionDays must be an integer", false), true
		}
		result, err := datasets.ApplyConversationRetention(ctx, retentionDays)
		if err != nil {
			return failure(request.ID, "CONVERSATION_RETENTION_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "conversation.append":
		input, ok := objectParam[data.ConversationAppendInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict conversation entry", false), true
		}
		result, err := datasets.AppendConversationEntry(ctx, input)
		if err != nil {
			return failure(request.ID, "CONVERSATION_APPEND_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return failure(request.ID, "METHOD_NOT_FOUND", "Unknown data-core method", false), true
	}
}
