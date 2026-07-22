package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const maximumWorkflowTriggerEvents = 10_000

type workflowTriggerCandidate struct {
	workflowID      string
	definition      int
	target          WorkflowTarget
	trigger         WorkflowTrigger
	nextDueAt       *string
	targetSignature string
}

func (service *Service) ClaimDueWorkflowTriggers(
	ctx context.Context,
	nowText string,
) ([]WorkflowTriggerEvent, error) {
	now, err := time.Parse(time.RFC3339Nano, nowText)
	if err != nil || now.After(time.Now().UTC().Add(5*time.Minute)) {
		return nil, errors.New("workflow trigger clock is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin workflow trigger claim: %w", err)
	}
	defer transaction.Rollback()
	candidates, err := loadWorkflowTriggerCandidates(ctx, transaction)
	if err != nil {
		return nil, err
	}
	for _, candidate := range candidates {
		if err := claimWorkflowTriggerCandidate(ctx, transaction, candidate, now.UTC()); err != nil {
			return nil, err
		}
	}
	if err := transaction.Commit(); err != nil {
		return nil, fmt.Errorf("commit workflow trigger claim: %w", err)
	}
	return service.listPendingWorkflowTriggers(ctx)
}

func loadWorkflowTriggerCandidates(
	ctx context.Context,
	transaction *sql.Tx,
) ([]workflowTriggerCandidate, error) {
	rows, err := transaction.QueryContext(ctx, `
SELECT id, version, target_kind, target_id, trigger_json, next_due_at, target_signature
FROM workflow_definitions
WHERE deleted_at IS NULL AND trigger_json <> '{"kind":"manual"}'
ORDER BY updated_at, id LIMIT ?`, maximumWorkflowDefinitions)
	if err != nil {
		return nil, fmt.Errorf("load workflow trigger candidates: %w", err)
	}
	defer rows.Close()
	result := make([]workflowTriggerCandidate, 0)
	for rows.Next() {
		var candidate workflowTriggerCandidate
		var triggerJSON string
		var nextDueAt sql.NullString
		if err := rows.Scan(
			&candidate.workflowID, &candidate.definition, &candidate.target.Kind,
			&candidate.target.ID, &triggerJSON, &nextDueAt, &candidate.targetSignature,
		); err != nil {
			return nil, fmt.Errorf("scan workflow trigger candidate: %w", err)
		}
		candidate.trigger, err = decodeWorkflowTrigger(triggerJSON)
		if err != nil {
			return nil, err
		}
		candidate.nextDueAt = nullableString(nextDueAt)
		result = append(result, candidate)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workflow trigger candidates: %w", err)
	}
	return result, rows.Close()
}

func claimWorkflowTriggerCandidate(
	ctx context.Context,
	transaction *sql.Tx,
	candidate workflowTriggerCandidate,
	now time.Time,
) error {
	dueAt := ""
	dedupeKey := ""
	nextDueAt := candidate.nextDueAt
	nextSignature := candidate.targetSignature
	if candidate.trigger.Kind == "interval" || candidate.trigger.Kind == "calendar" {
		if candidate.nextDueAt == nil {
			return errors.New("scheduled workflow has no next due time")
		}
		due, err := time.Parse(time.RFC3339Nano, *candidate.nextDueAt)
		if err != nil {
			return errors.New("scheduled workflow has an invalid next due time")
		}
		if due.After(now) {
			return nil
		}
		dueAt = due.UTC().Format(time.RFC3339Nano)
		dedupeKey = candidate.trigger.Kind + ":" + dueAt
		var next string
		if candidate.trigger.Kind == "calendar" {
			nextDue, err := nextCalendarWorkflowDue(candidate.trigger, now)
			if err != nil {
				return err
			}
			next = nextDue.Format(time.RFC3339Nano)
		} else {
			next = now.Add(time.Duration(candidate.trigger.EveryMinutes) * time.Minute).UTC().Format(time.RFC3339Nano)
		}
		nextDueAt = &next
	} else if candidate.trigger.Kind == "dataset-version" {
		signature, err := currentWorkflowTargetSignature(ctx, transaction, candidate.target)
		if err != nil {
			return err
		}
		if signature == candidate.targetSignature {
			return nil
		}
		dueAt = now.Format(time.RFC3339Nano)
		dedupeKey = "version:" + signature
		nextSignature = signature
	} else {
		return nil
	}
	var count int
	if err := transaction.QueryRowContext(ctx, `
SELECT COUNT(*) FROM workflow_trigger_events WHERE workflow_id = ?`, candidate.workflowID).Scan(&count); err != nil {
		return fmt.Errorf("count workflow trigger events: %w", err)
	}
	if count >= maximumWorkflowTriggerEvents {
		return fmt.Errorf("workflow reached the %d-trigger event limit", maximumWorkflowTriggerEvents)
	}
	eventID, err := newID()
	if err != nil {
		return err
	}
	operationID, err := newOperationID()
	if err != nil {
		return err
	}
	createdAt := now.Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO workflow_trigger_events(
  id, workflow_id, definition_version, operation_id, trigger_kind,
  dedupe_key, due_at, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
ON CONFLICT(workflow_id, dedupe_key) DO NOTHING`, eventID, candidate.workflowID,
		candidate.definition, operationID, candidate.trigger.Kind, dedupeKey, dueAt, createdAt); err != nil {
		return fmt.Errorf("enqueue workflow trigger: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_definitions SET next_due_at = ?, target_signature = ? WHERE id = ?`,
		nextDueAt, nextSignature, candidate.workflowID); err != nil {
		return fmt.Errorf("advance workflow trigger state: %w", err)
	}
	return nil
}

func (service *Service) listPendingWorkflowTriggers(ctx context.Context) ([]WorkflowTriggerEvent, error) {
	rows, err := service.database.QueryContext(ctx, workflowTriggerEventSelect+`
WHERE events.status = 'pending' AND definitions.deleted_at IS NULL
ORDER BY events.due_at, events.id LIMIT 100`)
	if err != nil {
		return nil, fmt.Errorf("list pending workflow triggers: %w", err)
	}
	defer rows.Close()
	result := make([]WorkflowTriggerEvent, 0)
	for rows.Next() {
		event, err := scanWorkflowTriggerEvent(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}
