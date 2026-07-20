package data

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (service *Service) ListConversations(ctx context.Context, target ConversationTarget) ([]ConversationThreadSummary, error) {
	if err := validateConversationTarget(target); err != nil {
		return nil, err
	}
	rows, err := service.database.QueryContext(ctx, `SELECT id, title, created_at, updated_at FROM conversation_threads WHERE target_kind = ? AND target_id = ? AND archived_at IS NULL ORDER BY updated_at DESC, id DESC`, target.Kind, target.ID)
	if err != nil {
		return nil, fmt.Errorf("list conversations: %w", err)
	}
	defer rows.Close()
	threads := make([]ConversationThreadSummary, 0)
	for rows.Next() {
		var thread ConversationThreadSummary
		thread.Target = target
		if err := rows.Scan(&thread.ID, &thread.Title, &thread.CreatedAt, &thread.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan conversation: %w", err)
		}
		threads = append(threads, thread)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate conversations: %w", err)
	}
	return threads, nil
}

func (service *Service) CreateConversation(ctx context.Context, input ConversationCreateInput) (*ConversationThread, error) {
	if err := validateConversationTarget(input.Target); err != nil {
		return nil, err
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin conversation creation: %w", err)
	}
	defer transaction.Rollback()
	if err := validateConversationTargetExists(ctx, transaction, input.Target); err != nil {
		return nil, err
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "新数据对话"
	}
	if len([]rune(title)) > 100 {
		return nil, errors.New("conversation title is too long")
	}
	id, err := newID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `INSERT INTO conversation_threads(id, target_kind, target_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, id, input.Target.Kind, input.Target.ID, title, now, now); err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return nil, fmt.Errorf("commit conversation creation: %w", err)
	}
	return service.GetConversationByID(ctx, id)
}

func (service *Service) RenameConversation(ctx context.Context, input ConversationRenameInput) (*ConversationThread, error) {
	title := strings.TrimSpace(input.Title)
	if !objectID.MatchString(input.ThreadID) || title == "" || len([]rune(title)) > 100 {
		return nil, errors.New("conversation rename input is invalid")
	}
	result, err := service.database.ExecContext(ctx, "UPDATE conversation_threads SET title = ?, updated_at = ? WHERE id = ?", title, time.Now().UTC().Format(time.RFC3339Nano), input.ThreadID)
	if err != nil {
		return nil, fmt.Errorf("rename conversation: %w", err)
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if changed != 1 {
		return nil, errors.New("conversation was not found")
	}
	return service.GetConversationByID(ctx, input.ThreadID)
}

func (service *Service) ArchiveConversation(ctx context.Context, input ConversationArchiveInput) error {
	if !objectID.MatchString(input.ThreadID) {
		return errors.New("conversation thread id is invalid")
	}
	var archivedAt any
	if input.Archived {
		archivedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	result, err := service.database.ExecContext(ctx, "UPDATE conversation_threads SET archived_at = ?, updated_at = ? WHERE id = ?", archivedAt, time.Now().UTC().Format(time.RFC3339Nano), input.ThreadID)
	if err != nil {
		return fmt.Errorf("archive conversation: %w", err)
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return errors.New("conversation was not found")
	}
	return nil
}
