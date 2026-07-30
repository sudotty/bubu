package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	minimumConversationRetentionDays  = 30
	maximumConversationRetentionDays  = 3650
	maximumConversationRetentionBatch = 1000
)

func (service *Service) ListConversations(ctx context.Context, target ConversationTarget, archived bool) ([]ConversationThreadSummary, error) {
	if err := validateConversationTarget(target); err != nil {
		return nil, err
	}
	archivePredicate := "archived_at IS NULL"
	if archived {
		archivePredicate = "archived_at IS NOT NULL"
	}
	rows, err := service.database.QueryContext(ctx, `SELECT id, title, created_at, updated_at FROM conversation_threads WHERE target_kind = ? AND target_id = ? AND `+archivePredicate+` ORDER BY updated_at DESC, id DESC`, target.Kind, target.ID)
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

func (service *Service) DeleteConversation(ctx context.Context, input ConversationDeleteInput) (ConversationDeletionResult, error) {
	if !objectID.MatchString(input.ThreadID) || strings.TrimSpace(input.ExpectedTitle) == "" || len([]rune(input.ExpectedTitle)) > 100 {
		return ConversationDeletionResult{}, errors.New("conversation deletion input is invalid")
	}
	if _, err := time.Parse(time.RFC3339Nano, input.ExpectedUpdatedAt); err != nil {
		return ConversationDeletionResult{}, errors.New("conversation deletion timestamp is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("begin conversation deletion: %w", err)
	}
	defer transaction.Rollback()
	var title, updatedAt string
	var archivedAt sql.NullString
	if err := transaction.QueryRowContext(ctx, "SELECT title, updated_at, archived_at FROM conversation_threads WHERE id = ?", input.ThreadID).Scan(&title, &updatedAt, &archivedAt); errors.Is(err, sql.ErrNoRows) {
		return ConversationDeletionResult{}, errors.New("conversation was not found")
	} else if err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("load conversation deletion target: %w", err)
	}
	if !archivedAt.Valid {
		return ConversationDeletionResult{}, errors.New("conversation must be archived before permanent deletion")
	}
	if title != strings.TrimSpace(input.ExpectedTitle) || updatedAt != input.ExpectedUpdatedAt {
		return ConversationDeletionResult{}, errors.New("conversation changed after deletion review")
	}
	var references int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM workflow_definitions WHERE thread_id = ?", input.ThreadID).Scan(&references); err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("check conversation references: %w", err)
	}
	if references != 0 {
		return ConversationDeletionResult{}, errors.New("conversation is retained by workflow evidence")
	}
	var entryCount int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM conversation_entries WHERE thread_id = ?", input.ThreadID).Scan(&entryCount); err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("count conversation entries: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, "DELETE FROM conversation_threads WHERE id = ?", input.ThreadID); err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("delete conversation: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return ConversationDeletionResult{}, fmt.Errorf("commit conversation deletion: %w", err)
	}
	return ConversationDeletionResult{SchemaVersion: 1, ThreadID: input.ThreadID, DeletedEntryCount: entryCount, Reason: "manual", DeletedAt: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}

func (service *Service) ApplyConversationRetention(ctx context.Context, retentionDays int) (ConversationRetentionResult, error) {
	if retentionDays < minimumConversationRetentionDays || retentionDays > maximumConversationRetentionDays {
		return ConversationRetentionResult{}, errors.New("conversation retention days must be between 30 and 3650")
	}
	appliedAt := time.Now().UTC()
	cutoff := appliedAt.AddDate(0, 0, -retentionDays).Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ConversationRetentionResult{}, fmt.Errorf("begin conversation retention: %w", err)
	}
	defer transaction.Rollback()
	rows, err := transaction.QueryContext(ctx, `
SELECT threads.id, COUNT(entries.id)
FROM conversation_threads threads
LEFT JOIN conversation_entries entries ON entries.thread_id = threads.id
WHERE threads.archived_at IS NOT NULL AND threads.archived_at <= ?
  AND NOT EXISTS (SELECT 1 FROM workflow_definitions definitions WHERE definitions.thread_id = threads.id)
GROUP BY threads.id
ORDER BY threads.archived_at, threads.id
LIMIT ?`, cutoff, maximumConversationRetentionBatch)
	if err != nil {
		return ConversationRetentionResult{}, fmt.Errorf("list retained conversations: %w", err)
	}
	type candidate struct {
		id      string
		entries int
	}
	candidates := make([]candidate, 0)
	for rows.Next() {
		var item candidate
		if err := rows.Scan(&item.id, &item.entries); err != nil {
			rows.Close()
			return ConversationRetentionResult{}, fmt.Errorf("scan retained conversation: %w", err)
		}
		candidates = append(candidates, item)
	}
	if err := rows.Close(); err != nil {
		return ConversationRetentionResult{}, fmt.Errorf("close retained conversations: %w", err)
	}
	if err := rows.Err(); err != nil {
		return ConversationRetentionResult{}, fmt.Errorf("iterate retained conversations: %w", err)
	}
	deletedEntries := 0
	for _, item := range candidates {
		result, err := transaction.ExecContext(ctx, "DELETE FROM conversation_threads WHERE id = ? AND archived_at IS NOT NULL", item.id)
		if err != nil {
			return ConversationRetentionResult{}, fmt.Errorf("delete retained conversation: %w", err)
		}
		changed, err := result.RowsAffected()
		if err != nil {
			return ConversationRetentionResult{}, err
		}
		if changed == 1 {
			deletedEntries += item.entries
		}
	}
	if err := transaction.Commit(); err != nil {
		return ConversationRetentionResult{}, fmt.Errorf("commit conversation retention: %w", err)
	}
	return ConversationRetentionResult{SchemaVersion: 1, DeletedThreadCount: len(candidates), DeletedEntryCount: deletedEntries, AppliedAt: appliedAt.Format(time.RFC3339Nano)}, nil
}
