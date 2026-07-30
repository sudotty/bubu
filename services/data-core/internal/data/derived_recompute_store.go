package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const derivedRecomputeEventSelect = `SELECT
  events.id, events.source_dataset_id, events.source_version_id,
  events.target_dataset_id, targets.display_name, events.status,
  events.reason_kind, events.error, events.result_version_id,
  events.attempt, events.created_at, events.started_at, events.finished_at
FROM derived_recompute_events events
JOIN datasets targets ON targets.id = events.target_dataset_id `

func (service *Service) ListDerivedRecomputeEvents(ctx context.Context, targetDatasetID string) ([]DerivedRecomputeEvent, error) {
	if !objectID.MatchString(targetDatasetID) {
		return nil, errors.New("target dataset id is invalid")
	}
	rows, err := service.database.QueryContext(ctx, derivedRecomputeEventSelect+"WHERE events.target_dataset_id = ? ORDER BY events.created_at DESC, events.id DESC LIMIT 100", targetDatasetID)
	if err != nil {
		return nil, fmt.Errorf("list derived recompute events: %w", err)
	}
	defer rows.Close()
	result := make([]DerivedRecomputeEvent, 0)
	for rows.Next() {
		event, err := scanDerivedRecomputeEvent(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

func (service *Service) RetryDerivedRecomputeEvent(ctx context.Context, id string) (DerivedRecomputeEvent, error) {
	if !objectID.MatchString(id) {
		return DerivedRecomputeEvent{}, errors.New("derived recompute event id is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("begin derived recompute retry: %w", err)
	}
	defer transaction.Rollback()
	var targetDatasetID, status, createdAt string
	var attempt int
	if err := transaction.QueryRowContext(ctx, "SELECT target_dataset_id, status, attempt, created_at FROM derived_recompute_events WHERE id = ?", id).Scan(&targetDatasetID, &status, &attempt, &createdAt); errors.Is(err, sql.ErrNoRows) {
		return DerivedRecomputeEvent{}, errors.New("derived recompute event was not found")
	} else if err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("load derived recompute retry: %w", err)
	}
	if (status != "paused" && status != "failed") || attempt >= 3 {
		return DerivedRecomputeEvent{}, errors.New("derived recompute cannot be retried")
	}
	var newerSucceeded int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM derived_recompute_events WHERE target_dataset_id = ? AND status = 'succeeded' AND created_at > ?", targetDatasetID, createdAt).Scan(&newerSucceeded); err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("check superseding derived recompute: %w", err)
	}
	if newerSucceeded > 0 {
		return DerivedRecomputeEvent{}, errors.New("derived recompute was already superseded by a successful task")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `
UPDATE derived_recompute_events
SET status = 'cancelled', reason_kind = 'cancelled', error = '已由用户选择的重试任务合并', started_at = COALESCE(started_at, ?), finished_at = ?
WHERE target_dataset_id = ? AND id <> ? AND status = 'pending'`, now, now, targetDatasetID, id); err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("merge pending derived recomputes: %w", err)
	}
	result, err := transaction.ExecContext(ctx, `
UPDATE derived_recompute_events
SET status = 'pending', reason_kind = NULL, error = NULL, started_at = NULL, finished_at = NULL
WHERE id = ? AND status IN ('paused', 'failed') AND attempt < 3`, id)
	if err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("retry derived recompute: %w", err)
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return DerivedRecomputeEvent{}, errors.New("derived recompute cannot be retried")
	}
	if err := transaction.Commit(); err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("commit derived recompute retry: %w", err)
	}
	return service.getDerivedRecomputeEvent(ctx, id)
}

func (service *Service) CancelDerivedRecomputeEvent(ctx context.Context, id string) (DerivedRecomputeEvent, error) {
	if !objectID.MatchString(id) {
		return DerivedRecomputeEvent{}, errors.New("derived recompute event id is invalid")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	result, err := service.database.ExecContext(ctx, `
UPDATE derived_recompute_events
SET status = 'cancelled', reason_kind = 'cancelled', error = '用户取消了自动重算', started_at = COALESCE(started_at, ?), finished_at = ?
WHERE id = ? AND status = 'pending'`, now, now, id)
	if err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("cancel derived recompute: %w", err)
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return DerivedRecomputeEvent{}, errors.New("only a pending derived recompute can be cancelled")
	}
	return service.getDerivedRecomputeEvent(ctx, id)
}

func (service *Service) getDerivedRecomputeEvent(ctx context.Context, id string) (DerivedRecomputeEvent, error) {
	return scanDerivedRecomputeEvent(service.database.QueryRowContext(ctx, derivedRecomputeEventSelect+"WHERE events.id = ?", id))
}

type derivedRecomputeScanner interface{ Scan(...any) error }

func scanDerivedRecomputeEvent(scanner derivedRecomputeScanner) (DerivedRecomputeEvent, error) {
	var event DerivedRecomputeEvent
	var reason, errorText, resultVersion, startedAt, finishedAt sql.NullString
	if err := scanner.Scan(&event.ID, &event.SourceDatasetID, &event.SourceVersionID, &event.TargetDatasetID, &event.TargetDisplayName, &event.Status, &reason, &errorText, &resultVersion, &event.Attempt, &event.CreatedAt, &startedAt, &finishedAt); err != nil {
		return DerivedRecomputeEvent{}, fmt.Errorf("scan derived recompute event: %w", err)
	}
	event.ReasonKind, event.Error, event.ResultVersionID = nullableString(reason), nullableString(errorText), nullableString(resultVersion)
	event.StartedAt, event.FinishedAt = nullableString(startedAt), nullableString(finishedAt)
	if err := validateDerivedRecomputeEvent(event); err != nil {
		return DerivedRecomputeEvent{}, err
	}
	return event, nil
}

func validateDerivedRecomputeEvent(event DerivedRecomputeEvent) error {
	if !objectID.MatchString(event.ID) || !objectID.MatchString(event.SourceDatasetID) || !objectID.MatchString(event.SourceVersionID) || !objectID.MatchString(event.TargetDatasetID) {
		return errors.New("stored derived recompute event has an invalid identifier")
	}
	if event.Attempt < 0 || event.Attempt > 3 {
		return errors.New("stored derived recompute event has an invalid attempt")
	}
	if _, err := time.Parse(time.RFC3339Nano, event.CreatedAt); err != nil {
		return errors.New("stored derived recompute event has an invalid created timestamp")
	}
	terminal := event.Status == "succeeded" || event.Status == "paused" || event.Status == "failed" || event.Status == "cancelled"
	if (event.Status == "running" || terminal) != (event.StartedAt != nil) || terminal != (event.FinishedAt != nil) {
		return errors.New("stored derived recompute event has inconsistent timestamps")
	}
	if event.Status == "succeeded" {
		if event.ResultVersionID == nil || event.ReasonKind != nil || event.Error != nil {
			return errors.New("stored successful derived recompute event has inconsistent evidence")
		}
	} else if terminal {
		if event.ResultVersionID != nil || event.ReasonKind == nil || event.Error == nil {
			return errors.New("stored unsuccessful derived recompute event has inconsistent evidence")
		}
	} else if event.ResultVersionID != nil || event.ReasonKind != nil || event.Error != nil {
		return errors.New("stored active derived recompute event has terminal evidence")
	}
	return nil
}
