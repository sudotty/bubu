package data

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	maximumConversationEntries = 500
	maximumConversationPayload = 1024 * 1024
)

func validateConversationTarget(target ConversationTarget) error {
	if (target.Kind != "dataset" && target.Kind != "group") || !objectID.MatchString(target.ID) {
		return errors.New("conversation target is invalid")
	}
	return nil
}

func validateConversationEntry(input ConversationEntryInput) error {
	validRole := (input.Kind == "question" && input.Role == "user") ||
		((input.Kind == "plan" || input.Kind == "result" || input.Kind == "insight") && input.Role == "assistant") ||
		(input.Kind == "error" && input.Role == "system")
	if !validRole {
		return errors.New("conversation entry kind and role are invalid")
	}
	if len(input.Payload) == 0 || len(input.Payload) > maximumConversationPayload || !json.Valid(input.Payload) {
		return errors.New("conversation entry payload is invalid or too large")
	}
	trimmed := bytes.TrimSpace(input.Payload)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return errors.New("conversation entry payload must be an object")
	}
	return nil
}

func (service *Service) GetConversation(
	ctx context.Context,
	target ConversationTarget,
) (*ConversationThread, error) {
	if err := validateConversationTarget(target); err != nil {
		return nil, err
	}
	var thread ConversationThread
	err := service.database.QueryRowContext(ctx, `
SELECT id, title, created_at, updated_at
FROM conversation_threads
WHERE target_kind = ? AND target_id = ?`, target.Kind, target.ID).Scan(
		&thread.ID, &thread.Title, &thread.CreatedAt, &thread.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load conversation: %w", err)
	}
	thread.Target = target
	rows, err := service.database.QueryContext(ctx, `
SELECT id, ordinal, kind, role, payload_json, created_at
FROM conversation_entries
WHERE thread_id = ?
ORDER BY ordinal`, thread.ID)
	if err != nil {
		return nil, fmt.Errorf("load conversation entries: %w", err)
	}
	defer rows.Close()
	thread.Entries = make([]ConversationEntry, 0)
	for rows.Next() {
		var entry ConversationEntry
		var payload string
		entry.ThreadID = thread.ID
		if err := rows.Scan(&entry.ID, &entry.Ordinal, &entry.Kind, &entry.Role, &payload, &entry.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan conversation entry: %w", err)
		}
		entry.Payload = json.RawMessage(payload)
		if err := validateConversationEntry(ConversationEntryInput{Kind: entry.Kind, Role: entry.Role, Payload: entry.Payload}); err != nil {
			return nil, fmt.Errorf("stored conversation entry failed validation: %w", err)
		}
		thread.Entries = append(thread.Entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate conversation entries: %w", err)
	}
	return &thread, nil
}

func (service *Service) AppendConversationEntry(
	ctx context.Context,
	input ConversationAppendInput,
) (*ConversationThread, error) {
	if err := validateConversationTarget(input.Target); err != nil {
		return nil, err
	}
	if err := validateConversationEntry(input.Entry); err != nil {
		return nil, err
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin conversation append: %w", err)
	}
	defer transaction.Rollback()
	if err := validateConversationTargetExists(ctx, transaction, input.Target); err != nil {
		return nil, err
	}
	var threadID string
	var nextOrdinal int
	err = transaction.QueryRowContext(ctx, `
SELECT t.id, COALESCE(MAX(e.ordinal), 0) + 1
FROM conversation_threads t
LEFT JOIN conversation_entries e ON e.thread_id = t.id
WHERE t.target_kind = ? AND t.target_id = ?
GROUP BY t.id`, input.Target.Kind, input.Target.ID).Scan(&threadID, &nextOrdinal)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if errors.Is(err, sql.ErrNoRows) {
		if input.Entry.Kind != "question" {
			return nil, errors.New("a conversation must start with a user question")
		}
		threadID, err = newID()
		if err != nil {
			return nil, err
		}
		nextOrdinal = 1
		title, err := questionTitle(input.Entry.Payload)
		if err != nil {
			return nil, err
		}
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO conversation_threads(id, target_kind, target_id, title, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`, threadID, input.Target.Kind, input.Target.ID, title, now, now); err != nil {
			return nil, fmt.Errorf("create conversation: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("load conversation append position: %w", err)
	}
	if nextOrdinal > maximumConversationEntries {
		return nil, fmt.Errorf("conversation reached its %d-entry local limit", maximumConversationEntries)
	}
	entryID, err := newID()
	if err != nil {
		return nil, err
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO conversation_entries(id, thread_id, ordinal, kind, role, payload_json, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`, entryID, threadID, nextOrdinal, input.Entry.Kind, input.Entry.Role, string(input.Entry.Payload), now); err != nil {
		return nil, fmt.Errorf("append conversation entry: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, "UPDATE conversation_threads SET updated_at = ? WHERE id = ?", now, threadID); err != nil {
		return nil, fmt.Errorf("touch conversation: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return nil, fmt.Errorf("commit conversation append: %w", err)
	}
	return service.GetConversation(ctx, input.Target)
}

func validateConversationTargetExists(ctx context.Context, transaction *sql.Tx, target ConversationTarget) error {
	table := "datasets"
	if target.Kind == "group" {
		table = "dataset_groups"
	}
	var exists int
	query := fmt.Sprintf("SELECT 1 FROM %s WHERE id = ?", table)
	if err := transaction.QueryRowContext(ctx, query, target.ID).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
		return errors.New("conversation target was not found")
	} else if err != nil {
		return fmt.Errorf("validate conversation target: %w", err)
	}
	return nil
}

func questionTitle(payload json.RawMessage) (string, error) {
	var value struct {
		Question string `json:"question"`
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil || strings.TrimSpace(value.Question) == "" {
		return "", errors.New("question payload is invalid")
	}
	title := strings.TrimSpace(value.Question)
	if len([]rune(title)) > 100 {
		title = string([]rune(title)[:100])
	}
	return title, nil
}

func appendExistingConversationEntry(
	ctx context.Context,
	transaction *sql.Tx,
	target ConversationTarget,
	entry ConversationEntryInput,
	createdAt string,
) error {
	if err := validateConversationTarget(target); err != nil {
		return err
	}
	if err := validateConversationEntry(entry); err != nil {
		return err
	}
	var threadID string
	var nextOrdinal int
	if err := transaction.QueryRowContext(ctx, `
SELECT threads.id, COALESCE(MAX(entries.ordinal), 0) + 1
FROM conversation_threads threads
LEFT JOIN conversation_entries entries ON entries.thread_id = threads.id
WHERE threads.target_kind = ? AND threads.target_id = ?
GROUP BY threads.id`, target.Kind, target.ID).Scan(&threadID, &nextOrdinal); errors.Is(err, sql.ErrNoRows) {
		return errors.New("triggered workflow requires an existing reviewed conversation")
	} else if err != nil {
		return fmt.Errorf("load triggered workflow conversation: %w", err)
	}
	if nextOrdinal > maximumConversationEntries {
		return fmt.Errorf("conversation reached its %d-entry local limit", maximumConversationEntries)
	}
	entryID, err := newID()
	if err != nil {
		return err
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO conversation_entries(id, thread_id, ordinal, kind, role, payload_json, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`, entryID, threadID, nextOrdinal, entry.Kind,
		entry.Role, string(entry.Payload), createdAt); err != nil {
		return fmt.Errorf("append triggered workflow conversation entry: %w", err)
	}
	if _, err := transaction.ExecContext(ctx,
		"UPDATE conversation_threads SET updated_at = ? WHERE id = ?", createdAt, threadID,
	); err != nil {
		return fmt.Errorf("touch triggered workflow conversation: %w", err)
	}
	return nil
}
