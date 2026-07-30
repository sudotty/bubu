package data

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

func enqueueReconciliationDependents(ctx context.Context, transaction *sql.Tx, datasetID, versionID, occurredAt string) error {
	rows, err := transaction.QueryContext(ctx, `SELECT id, left_dataset_id, right_dataset_id FROM reconciliation_definitions WHERE active = 1 AND (left_dataset_id = ? OR right_dataset_id = ?)`, datasetID, datasetID)
	if err != nil {
		return fmt.Errorf("read reconciliation dependents: %w", err)
	}
	type dependent struct{ id, leftID, rightID string }
	values := []dependent{}
	for rows.Next() {
		var value dependent
		if err := rows.Scan(&value.id, &value.leftID, &value.rightID); err != nil {
			rows.Close()
			return err
		}
		values = append(values, value)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, value := range values {
		var leftVersion, rightVersion string
		if err := transaction.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id = ?", value.leftID).Scan(&leftVersion); err != nil {
			return err
		}
		if err := transaction.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id = ?", value.rightID).Scan(&rightVersion); err != nil {
			return err
		}
		signature := reconciliationSourceSignature(value.id, leftVersion, rightVersion)
		if _, err := transaction.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status='cancelled', reason_kind='stale-source', error='Superseded by a newer source-version pair', finished_at=? WHERE definition_id=? AND status IN ('pending','paused','failed') AND source_signature<>?`, occurredAt, value.id, signature); err != nil {
			return err
		}
		id, err := newID()
		if err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `INSERT OR IGNORE INTO reconciliation_replay_events(id, definition_id, trigger_dataset_id, trigger_version_id, source_signature, status, attempt, created_at) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`, id, value.id, datasetID, versionID, signature, occurredAt); err != nil {
			return fmt.Errorf("enqueue reconciliation replay: %w", err)
		}
	}
	return nil
}

func reconciliationSourceSignature(definitionID, leftVersion, rightVersion string) string {
	digest := sha256.Sum256([]byte(definitionID + ":" + leftVersion + ":" + rightVersion))
	return hex.EncodeToString(digest[:])
}

func recoverInterruptedReconciliationReplays(ctx context.Context, database *sql.DB) error {
	transaction, err := database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `UPDATE reconciliation_replay_events
SET status='pending', reason_kind=NULL, error=NULL, artifact_id=NULL, started_at=NULL, finished_at=NULL
WHERE status='running' AND attempt < 3`); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `UPDATE reconciliation_replay_events
SET status='failed', reason_kind='execution-error', error='Replay interrupted after the maximum retry attempt', artifact_id=NULL, finished_at=?
WHERE status='running' AND attempt >= 3`, now); err != nil {
		return err
	}
	return transaction.Commit()
}

func (service *Service) ProcessReconciliationReplayEvents(ctx context.Context) ([]ReconciliationReplayEvent, error) {
	result := []ReconciliationReplayEvent{}
	for len(result) < 20 {
		event, found, err := service.claimReconciliationReplay(ctx)
		if err != nil {
			return nil, err
		}
		if !found {
			break
		}
		finished, err := service.runReconciliationReplay(ctx, event)
		if err != nil {
			return nil, err
		}
		result = append(result, finished)
	}
	return result, nil
}

func (service *Service) claimReconciliationReplay(ctx context.Context) (ReconciliationReplayEvent, bool, error) {
	tx, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ReconciliationReplayEvent{}, false, err
	}
	defer tx.Rollback()
	var event ReconciliationReplayEvent
	event.SchemaVersion = 1
	err = tx.QueryRowContext(ctx, `SELECT id, definition_id, trigger_dataset_id, trigger_version_id, source_signature, attempt, created_at FROM reconciliation_replay_events WHERE status='pending' ORDER BY created_at, id LIMIT 1`).Scan(&event.ID, &event.DefinitionID, &event.TriggerDatasetID, &event.TriggerVersionID, &event.SourceSignature, &event.Attempt, &event.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ReconciliationReplayEvent{}, false, nil
	}
	if err != nil {
		return ReconciliationReplayEvent{}, false, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	event.Attempt++
	event.Status = "running"
	event.StartedAt = &now
	if _, err := tx.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status='running', attempt=?, started_at=?, reason_kind=NULL, error=NULL, finished_at=NULL WHERE id=? AND status='pending'`, event.Attempt, now, event.ID); err != nil {
		return ReconciliationReplayEvent{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return ReconciliationReplayEvent{}, false, err
	}
	return event, true, nil
}

func (service *Service) runReconciliationReplay(ctx context.Context, event ReconciliationReplayEvent) (ReconciliationReplayEvent, error) {
	var rawPlan, rawBaseline string
	if err := service.database.QueryRowContext(ctx, `SELECT plan_json, baseline_preview_json FROM reconciliation_definitions WHERE id=? AND active=1`, event.DefinitionID).Scan(&rawPlan, &rawBaseline); err != nil {
		return service.finishReconciliationReplay(ctx, event, "failed", "execution-error", "Reviewed reconciliation definition is unavailable", nil)
	}
	var plan ReconciliationPlan
	var baseline ReconciliationPreview
	if json.Unmarshal([]byte(rawPlan), &plan) != nil || json.Unmarshal([]byte(rawBaseline), &baseline) != nil {
		return service.finishReconciliationReplay(ctx, event, "failed", "execution-error", "Reviewed reconciliation definition is invalid", nil)
	}
	var leftVersion, rightVersion string
	if err := service.database.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id=?", plan.Comparison.Sources.Left.DatasetID).Scan(&leftVersion); err != nil {
		return service.finishReconciliationReplay(ctx, event, "paused", "stale-source", "Left source is unavailable", nil)
	}
	if err := service.database.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id=?", plan.Comparison.Sources.Right.DatasetID).Scan(&rightVersion); err != nil {
		return service.finishReconciliationReplay(ctx, event, "paused", "stale-source", "Right source is unavailable", nil)
	}
	if reconciliationSourceSignature(event.DefinitionID, leftVersion, rightVersion) != event.SourceSignature {
		return service.finishReconciliationReplay(ctx, event, "cancelled", "stale-source", "Superseded by newer source versions", nil)
	}
	plan.Comparison.Sources.Left.VersionID, plan.Comparison.Sources.Right.VersionID = leftVersion, rightVersion
	preview, execution, err := service.evaluateReconciliation(ctx, plan)
	if err != nil {
		reason := "execution-error"
		status := "failed"
		if strings.Contains(err.Error(), "column") || strings.Contains(err.Error(), "stale source") {
			reason, status = "schema-drift", "paused"
		}
		return service.finishReconciliationReplay(ctx, event, status, reason, err.Error(), nil)
	}
	if preview.Counts.LeftDuplicate > baseline.Counts.LeftDuplicate || preview.Counts.RightDuplicate > baseline.Counts.RightDuplicate || preview.Counts.Pending > baseline.Counts.Pending {
		return service.finishReconciliationReplay(ctx, event, "paused", "cardinality-change", "Duplicate or pending candidate counts exceeded the reviewed baseline", nil)
	}
	for index, source := range preview.Sources {
		if index >= len(baseline.Sources) || source.QualityScore < baseline.Sources[index].QualityScore {
			return service.finishReconciliationReplay(ctx, event, "paused", "quality-change", "Source quality score fell below the reviewed baseline", nil)
		}
	}
	for index, total := range preview.ControlTotals {
		if index >= len(baseline.ControlTotals) || math.Abs(total.Difference) > math.Abs(baseline.ControlTotals[index].Difference)+total.Tolerance {
			return service.finishReconciliationReplay(ctx, event, "paused", "control-total-change", "Control-total difference exceeded the reviewed baseline", nil)
		}
	}
	rawReboundPlan, fingerprint, err := reconciliationPlanEvidence(plan)
	if err != nil {
		return service.finishReconciliationReplay(ctx, event, "failed", "execution-error", err.Error(), nil)
	}
	preview.PlanFingerprint = fingerprint
	definitionID := event.DefinitionID
	artifact, err := newReconciliationArtifact(plan, preview, execution, "reviewed-replay", &definitionID)
	if err != nil {
		return ReconciliationReplayEvent{}, err
	}
	tx, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ReconciliationReplayEvent{}, err
	}
	defer tx.Rollback()
	if err := insertReconciliationArtifact(ctx, tx, artifact, rawReboundPlan, fingerprint); err != nil {
		return ReconciliationReplayEvent{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := tx.ExecContext(ctx, `UPDATE reconciliation_definitions SET plan_json=?, plan_fingerprint=?, last_artifact_id=?, updated_at=? WHERE id=?`, string(rawReboundPlan), fingerprint, artifact.ID, now, event.DefinitionID); err != nil {
		return ReconciliationReplayEvent{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status='succeeded', reason_kind=NULL, error=NULL, artifact_id=?, finished_at=? WHERE id=? AND status='running'`, artifact.ID, now, event.ID); err != nil {
		return ReconciliationReplayEvent{}, err
	}
	if err := tx.Commit(); err != nil {
		return ReconciliationReplayEvent{}, err
	}
	event.Status, event.ArtifactID, event.FinishedAt = "succeeded", &artifact.ID, &now
	event.ReasonKind, event.Error = nil, nil
	return event, nil
}

func (service *Service) finishReconciliationReplay(ctx context.Context, event ReconciliationReplayEvent, status, reason, message string, artifactID *string) (ReconciliationReplayEvent, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if len(message) > 2000 {
		message = message[:2000]
	}
	if _, err := service.database.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status=?, reason_kind=?, error=?, artifact_id=?, finished_at=? WHERE id=?`, status, reason, message, artifactID, now, event.ID); err != nil {
		return ReconciliationReplayEvent{}, err
	}
	event.Status, event.ReasonKind, event.Error, event.ArtifactID, event.FinishedAt = status, &reason, &message, artifactID, &now
	return event, nil
}

func (service *Service) ListReconciliationReplayEvents(ctx context.Context, datasetIDs []string) ([]ReconciliationReplayEvent, error) {
	if len(datasetIDs) < 1 || len(datasetIDs) > 8 {
		return nil, errors.New("reconciliation replay filter is invalid")
	}
	placeholders := make([]string, len(datasetIDs))
	args := make([]any, len(datasetIDs))
	for i, id := range datasetIDs {
		if !objectID.MatchString(id) {
			return nil, errors.New("reconciliation replay filter is invalid")
		}
		placeholders[i] = "?"
		args[i] = id
	}
	rows, err := service.database.QueryContext(ctx, `SELECT e.id,e.definition_id,e.trigger_dataset_id,e.trigger_version_id,e.source_signature,e.status,e.reason_kind,e.error,e.artifact_id,e.attempt,e.created_at,e.started_at,e.finished_at FROM reconciliation_replay_events e JOIN reconciliation_definitions d ON d.id=e.definition_id WHERE d.left_dataset_id IN (`+strings.Join(placeholders, ",")+`) OR d.right_dataset_id IN (`+strings.Join(placeholders, ",")+`) ORDER BY e.created_at DESC,e.id DESC LIMIT 1000`, append(args, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ReconciliationReplayEvent{}
	for rows.Next() {
		value, err := scanReconciliationReplay(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, rows.Err()
}

type reconciliationReplayScanner interface{ Scan(...any) error }

func scanReconciliationReplay(row reconciliationReplayScanner) (ReconciliationReplayEvent, error) {
	var value ReconciliationReplayEvent
	var reason, errorText, artifactID, started, finished sql.NullString
	value.SchemaVersion = 1
	err := row.Scan(&value.ID, &value.DefinitionID, &value.TriggerDatasetID, &value.TriggerVersionID, &value.SourceSignature, &value.Status, &reason, &errorText, &artifactID, &value.Attempt, &value.CreatedAt, &started, &finished)
	if reason.Valid {
		value.ReasonKind = &reason.String
	}
	if errorText.Valid {
		value.Error = &errorText.String
	}
	if artifactID.Valid {
		value.ArtifactID = &artifactID.String
	}
	if started.Valid {
		value.StartedAt = &started.String
	}
	if finished.Valid {
		value.FinishedAt = &finished.String
	}
	return value, err
}
func (service *Service) RetryReconciliationReplayEvent(ctx context.Context, id string) (ReconciliationReplayEvent, error) {
	return service.transitionReconciliationReplay(ctx, id, "retry")
}
func (service *Service) CancelReconciliationReplayEvent(ctx context.Context, id string) (ReconciliationReplayEvent, error) {
	return service.transitionReconciliationReplay(ctx, id, "cancel")
}
func (service *Service) transitionReconciliationReplay(ctx context.Context, id, action string) (ReconciliationReplayEvent, error) {
	if !objectID.MatchString(id) {
		return ReconciliationReplayEvent{}, errors.New("reconciliation replay id is invalid")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if action == "retry" {
		result, err := service.database.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status='pending',reason_kind=NULL,error=NULL,artifact_id=NULL,started_at=NULL,finished_at=NULL WHERE id=? AND status IN ('paused','failed','cancelled') AND attempt<3`, id)
		if err != nil {
			return ReconciliationReplayEvent{}, err
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ReconciliationReplayEvent{}, errors.New("reconciliation replay cannot be retried")
		}
	} else {
		result, err := service.database.ExecContext(ctx, `UPDATE reconciliation_replay_events SET status='cancelled',reason_kind='cancelled',error='Cancelled by user',finished_at=? WHERE id=? AND status IN ('pending','paused','failed')`, now, id)
		if err != nil {
			return ReconciliationReplayEvent{}, err
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ReconciliationReplayEvent{}, errors.New("reconciliation replay cannot be cancelled")
		}
	}
	var value ReconciliationReplayEvent
	var reason, errorText, artifactID, started, finished sql.NullString
	value.SchemaVersion = 1
	err := service.database.QueryRowContext(ctx, `SELECT id,definition_id,trigger_dataset_id,trigger_version_id,source_signature,status,reason_kind,error,artifact_id,attempt,created_at,started_at,finished_at FROM reconciliation_replay_events WHERE id=?`, id).Scan(&value.ID, &value.DefinitionID, &value.TriggerDatasetID, &value.TriggerVersionID, &value.SourceSignature, &value.Status, &reason, &errorText, &artifactID, &value.Attempt, &value.CreatedAt, &started, &finished)
	if err != nil {
		return ReconciliationReplayEvent{}, err
	}
	if reason.Valid {
		value.ReasonKind = &reason.String
	}
	if errorText.Valid {
		value.Error = &errorText.String
	}
	if artifactID.Valid {
		value.ArtifactID = &artifactID.String
	}
	if started.Valid {
		value.StartedAt = &started.String
	}
	if finished.Valid {
		value.FinishedAt = &finished.String
	}
	return value, nil
}
