package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const maximumDerivedRecomputeEvents = 10_000

func enqueueDerivedDependents(ctx context.Context, transaction *sql.Tx, sourceDatasetID, sourceVersionID, createdAt string) error {
	rows, err := transaction.QueryContext(ctx, `
SELECT DISTINCT lineages.dataset_id
FROM derived_dataset_lineages lineages
JOIN datasets derived ON derived.id = lineages.dataset_id AND derived.current_version_id = lineages.version_id
JOIN derived_dataset_lineage_parents parents ON parents.derived_version_id = lineages.version_id
WHERE parents.parent_dataset_id = ? AND lineages.dataset_id <> ?
ORDER BY lineages.dataset_id`, sourceDatasetID, sourceDatasetID)
	if err != nil {
		return fmt.Errorf("load direct derived dependents: %w", err)
	}
	defer rows.Close()
	targets := make([]string, 0)
	for rows.Next() {
		var target string
		if err := rows.Scan(&target); err != nil {
			return fmt.Errorf("scan direct derived dependent: %w", err)
		}
		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate direct derived dependents: %w", err)
	}
	plan, err := getDerivedDependencyPlan(ctx, transaction, sourceDatasetID)
	if err != nil {
		return err
	}
	directTargets := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		directTargets[target] = struct{}{}
	}
	orderedTargets := make([]string, 0, len(targets))
	for _, target := range plan.OrderedDatasetIDs {
		if _, direct := directTargets[target]; direct {
			orderedTargets = append(orderedTargets, target)
		}
	}
	createdTime, err := time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return errors.New("derived recompute creation time is invalid")
	}
	for index, target := range orderedTargets {
		var count int
		if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM derived_recompute_events").Scan(&count); err != nil {
			return fmt.Errorf("count derived recompute events: %w", err)
		}
		if count >= maximumDerivedRecomputeEvents {
			return fmt.Errorf("derived recompute queue reached its %d-event limit", maximumDerivedRecomputeEvents)
		}
		id, err := newID()
		if err != nil {
			return err
		}
		dedupeKey := sourceVersionID + ":" + target
		orderedCreatedAt := createdTime.Add(time.Duration(index) * time.Nanosecond).Format(time.RFC3339Nano)
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO derived_recompute_events(
    id, source_dataset_id, source_version_id, target_dataset_id,
    dedupe_key, status, attempt, created_at
) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)
ON CONFLICT(dedupe_key) DO NOTHING`, id, sourceDatasetID, sourceVersionID, target, dedupeKey, orderedCreatedAt); err != nil {
			return fmt.Errorf("enqueue derived recompute: %w", err)
		}
	}
	return nil
}

func recoverInterruptedDerivedRecomputes(ctx context.Context, database *sql.DB) error {
	if _, err := database.ExecContext(ctx, `UPDATE derived_recompute_events SET status = 'pending', started_at = NULL WHERE status = 'running'`); err != nil {
		return fmt.Errorf("recover interrupted derived recomputes: %w", err)
	}
	return nil
}

func (service *Service) ProcessDerivedRecomputeEvents(ctx context.Context) ([]DerivedRecomputeEvent, error) {
	result := make([]DerivedRecomputeEvent, 0)
	for len(result) < 100 {
		sourceDatasetID, err := firstPendingRecomputeSource(ctx, service.database)
		if err != nil {
			return nil, err
		}
		if sourceDatasetID == "" {
			break
		}
		if _, err := service.GetDerivedDependencyPlan(ctx, sourceDatasetID); err != nil {
			return nil, err
		}
		event, found, err := service.claimDerivedRecompute(ctx)
		if err != nil {
			return nil, err
		}
		if !found {
			break
		}
		materialized, recomputeErr := service.RecomputeDerivedDataset(ctx, event.TargetDatasetID)
		finished, finishErr := service.finishDerivedRecompute(ctx, event, materialized, recomputeErr)
		if finishErr != nil {
			return nil, finishErr
		}
		if err := service.deliverDerivedRecomputeConversation(ctx, finished); err != nil {
			return nil, err
		}
		result = append(result, finished)
	}
	return result, nil
}

func (service *Service) deliverDerivedRecomputeConversation(ctx context.Context, event DerivedRecomputeEvent) error {
	target := ConversationTarget{Kind: "dataset", ID: event.TargetDatasetID}
	thread, err := service.GetConversation(ctx, target)
	if err != nil {
		return fmt.Errorf("load derived recompute conversation: %w", err)
	}
	if thread == nil {
		thread, err = service.CreateConversation(ctx, ConversationCreateInput{Target: target, Title: "自动重算记录"})
		if err != nil {
			return fmt.Errorf("create derived recompute conversation: %w", err)
		}
	}
	message := "已基于最新上游版本创建不可变新版本。"
	if event.Status != "succeeded" {
		message = "自动重算已暂停，修复数据或计划后可在派生关系中重试。"
		if event.Error != nil {
			message += " " + *event.Error
		}
	}
	payload, err := json.Marshal(map[string]any{"automation": map[string]any{
		"eventId": event.ID, "targetDatasetId": event.TargetDatasetID, "targetDisplayName": event.TargetDisplayName,
		"sourceVersionId": event.SourceVersionID, "resultVersionId": event.ResultVersionID,
		"status": event.Status, "reasonKind": event.ReasonKind, "message": message,
	}})
	if err != nil {
		return fmt.Errorf("encode derived recompute conversation: %w", err)
	}
	_, err = service.AppendConversationEntry(ctx, ConversationAppendInput{Target: target, ThreadID: thread.ID, Entry: ConversationEntryInput{Kind: "insight", Role: "assistant", Payload: payload}})
	if err != nil {
		return fmt.Errorf("deliver derived recompute conversation: %w", err)
	}
	return nil
}

func firstPendingRecomputeSource(ctx context.Context, database *sql.DB) (string, error) {
	var id string
	err := database.QueryRowContext(ctx, "SELECT source_dataset_id FROM derived_recompute_events WHERE status = 'pending' ORDER BY created_at, id LIMIT 1").Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load pending derived recompute source: %w", err)
	}
	return id, nil
}

func (service *Service) claimDerivedRecompute(ctx context.Context) (DerivedRecomputeEvent, bool, error) {
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DerivedRecomputeEvent{}, false, fmt.Errorf("begin derived recompute claim: %w", err)
	}
	defer transaction.Rollback()
	var id string
	err = transaction.QueryRowContext(ctx, "SELECT id FROM derived_recompute_events WHERE status = 'pending' AND attempt < 3 ORDER BY created_at, id LIMIT 1").Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return DerivedRecomputeEvent{}, false, nil
	}
	if err != nil {
		return DerivedRecomputeEvent{}, false, fmt.Errorf("load pending derived recompute: %w", err)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	result, err := transaction.ExecContext(ctx, "UPDATE derived_recompute_events SET status = 'running', started_at = ?, attempt = attempt + 1 WHERE id = ? AND status = 'pending'", now, id)
	if err != nil {
		return DerivedRecomputeEvent{}, false, fmt.Errorf("claim derived recompute: %w", err)
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return DerivedRecomputeEvent{}, false, errors.New("derived recompute was already claimed")
	}
	if err := transaction.Commit(); err != nil {
		return DerivedRecomputeEvent{}, false, fmt.Errorf("commit derived recompute claim: %w", err)
	}
	event, err := service.getDerivedRecomputeEvent(ctx, id)
	return event, true, err
}

func (service *Service) finishDerivedRecompute(ctx context.Context, event DerivedRecomputeEvent, materialized DerivedDatasetMaterializationResult, recomputeErr error) (DerivedRecomputeEvent, error) {
	status, reason, errorText := "succeeded", "", ""
	var resultVersion any = materialized.Dataset.VersionID
	if recomputeErr != nil {
		resultVersion = nil
		errorText = recomputeErr.Error()
		if len(errorText) > 2_000 {
			errorText = errorText[:2_000]
		}
		status, reason = classifyDerivedRecomputeFailure(recomputeErr)
	}
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	var reasonValue, errorValue any
	if reason != "" {
		reasonValue, errorValue = reason, errorText
	}
	result, err := service.database.ExecContext(ctx, `UPDATE derived_recompute_events SET status = ?, reason_kind = ?, error = ?, result_version_id = ?, finished_at = ? WHERE id = ? AND status = 'running'`, status, reasonValue, errorValue, resultVersion, finishedAt, event.ID)
	if err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("finish derived recompute: %w", err)
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return DerivedRecomputeEvent{}, errors.New("derived recompute was not running")
	}
	return service.getDerivedRecomputeEvent(ctx, event.ID)
}

func classifyDerivedRecomputeFailure(err error) (string, string) {
	if errors.Is(err, context.Canceled) {
		return "cancelled", "cancelled"
	}
	text := strings.ToLower(err.Error())
	if strings.Contains(text, "quality gate blocked") {
		return "paused", "quality-block"
	}
	if strings.Contains(text, "stale source") || strings.Contains(text, "stale parent") {
		return "paused", "stale-source"
	}
	if strings.Contains(text, "column") || strings.Contains(text, "schema") || strings.Contains(text, "source version was not found") {
		return "paused", "schema-drift"
	}
	return "failed", "execution-error"
}
