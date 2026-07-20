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

func (service *Service) SaveWorkflow(
	ctx context.Context,
	input WorkflowDefinitionInput,
) (WorkflowDefinition, error) {
	if err := validateWorkflowDefinitionInput(input); err != nil {
		return WorkflowDefinition{}, err
	}
	stepsJSON, err := json.Marshal(input.Steps)
	if err != nil || len(stepsJSON) > maximumWorkflowJSONBytes {
		return WorkflowDefinition{}, errors.New("workflow steps exceed the persistence budget")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return WorkflowDefinition{}, fmt.Errorf("begin workflow save: %w", err)
	}
	defer transaction.Rollback()
	if err := validateConversationTargetExists(ctx, transaction, ConversationTarget(input.Target)); err != nil {
		return WorkflowDefinition{}, fmt.Errorf("validate workflow target: %w", err)
	}
	if err := validateWorkflowThread(ctx, transaction, input.Target, input.ThreadID); err != nil {
		return WorkflowDefinition{}, err
	}
	nowTime := time.Now().UTC()
	now := nowTime.Format(time.RFC3339Nano)
	triggerJSON, nextDueAt, targetSignature, err := initialWorkflowTriggerState(
		ctx, transaction, input.Target, input.Trigger, nowTime,
	)
	if err != nil {
		return WorkflowDefinition{}, err
	}
	workflowID := input.ID
	if workflowID == "" {
		var count int
		if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM workflow_definitions WHERE deleted_at IS NULL").Scan(&count); err != nil {
			return WorkflowDefinition{}, fmt.Errorf("count workflows: %w", err)
		}
		if count >= maximumWorkflowDefinitions {
			return WorkflowDefinition{}, fmt.Errorf("cannot store more than %d active workflows", maximumWorkflowDefinitions)
		}
		workflowID, err = newID()
		if err != nil {
			return WorkflowDefinition{}, err
		}
		_, err = transaction.ExecContext(ctx, `
INSERT INTO workflow_definitions(
  id, name, target_kind, target_id, thread_id, version, trigger_kind,
  timeout_ms, steps_json, created_at, updated_at, trigger_json, next_due_at, target_signature
) VALUES (?, ?, ?, ?, ?, 1, 'manual', ?, ?, ?, ?, ?, ?, ?)`,
			workflowID, strings.TrimSpace(input.Name), input.Target.Kind, input.Target.ID,
			input.ThreadID, input.TimeoutMS, string(stepsJSON), now, now, triggerJSON, nextDueAt, targetSignature)
	} else {
		result, updateErr := transaction.ExecContext(ctx, `
UPDATE workflow_definitions
SET name = ?, version = version + 1, timeout_ms = ?, steps_json = ?, updated_at = ?,
    trigger_json = ?, next_due_at = ?, target_signature = ?
WHERE id = ? AND target_kind = ? AND target_id = ? AND thread_id = ? AND deleted_at IS NULL`,
			strings.TrimSpace(input.Name), input.TimeoutMS, string(stepsJSON), now,
			triggerJSON, nextDueAt, targetSignature,
			workflowID, input.Target.Kind, input.Target.ID, input.ThreadID)
		if updateErr != nil {
			return WorkflowDefinition{}, fmt.Errorf("update workflow: %w", updateErr)
		}
		affected, rowsErr := result.RowsAffected()
		if rowsErr != nil || affected != 1 {
			return WorkflowDefinition{}, errors.New("workflow was not found or its target changed")
		}
		if err := cancelPendingWorkflowTriggers(
			ctx, transaction, workflowID, "Workflow definition changed before the trigger ran", now,
		); err != nil {
			return WorkflowDefinition{}, err
		}
	}
	if err != nil {
		return WorkflowDefinition{}, fmt.Errorf("create workflow: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return WorkflowDefinition{}, fmt.Errorf("commit workflow: %w", err)
	}
	return service.GetWorkflow(ctx, workflowID)
}

func (service *Service) GetWorkflow(ctx context.Context, workflowID string) (WorkflowDefinition, error) {
	if !objectID.MatchString(workflowID) {
		return WorkflowDefinition{}, errors.New("workflow id is invalid")
	}
	row := service.database.QueryRowContext(ctx, `
SELECT id, name, target_kind, target_id, thread_id, version, trigger_kind,
       timeout_ms, steps_json, created_at, updated_at, trigger_json, next_due_at
FROM workflow_definitions WHERE id = ? AND deleted_at IS NULL`, workflowID)
	return scanWorkflowDefinition(row)
}

func (service *Service) ListWorkflows(
	ctx context.Context,
	target *WorkflowTarget,
) ([]WorkflowDefinition, error) {
	query := `SELECT id, name, target_kind, target_id, thread_id, version, trigger_kind,
       timeout_ms, steps_json, created_at, updated_at, trigger_json, next_due_at
FROM workflow_definitions WHERE deleted_at IS NULL`
	args := make([]any, 0, 2)
	if target != nil {
		if !objectID.MatchString(target.ID) || (target.Kind != "dataset" && target.Kind != "group") {
			return nil, errors.New("workflow target is invalid")
		}
		query += " AND target_kind = ? AND target_id = ?"
		args = append(args, target.Kind, target.ID)
	}
	query += " ORDER BY updated_at DESC, id LIMIT ?"
	args = append(args, maximumWorkflowDefinitions)
	rows, err := service.database.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list workflows: %w", err)
	}
	defer rows.Close()
	result := make([]WorkflowDefinition, 0)
	for rows.Next() {
		workflow, err := scanWorkflowDefinition(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, workflow)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workflows: %w", err)
	}
	return result, nil
}

func (service *Service) DeleteWorkflow(ctx context.Context, workflowID string) error {
	if !objectID.MatchString(workflowID) {
		return errors.New("workflow id is invalid")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin workflow deletion: %w", err)
	}
	defer transaction.Rollback()
	result, err := transaction.ExecContext(ctx, `
UPDATE workflow_definitions SET deleted_at = ?, updated_at = ?
WHERE id = ? AND deleted_at IS NULL`, now, now, workflowID)
	if err != nil {
		return fmt.Errorf("delete workflow: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return errors.New("workflow not found")
	}
	if err := cancelPendingWorkflowTriggers(
		ctx, transaction, workflowID, "Workflow was removed before the trigger ran", now,
	); err != nil {
		return err
	}
	return transaction.Commit()
}

func retireTargetWorkflows(
	ctx context.Context,
	transaction *sql.Tx,
	target WorkflowTarget,
	deletedAt string,
) error {
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_definitions SET deleted_at = ?, updated_at = ?
WHERE target_kind = ? AND target_id = ? AND deleted_at IS NULL`,
		deletedAt, deletedAt, target.Kind, target.ID); err != nil {
		return fmt.Errorf("retire target workflows: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_trigger_events
SET status = 'cancelled', error = 'Workflow target changed or was removed', finished_at = ?
WHERE status = 'pending' AND workflow_id IN (
  SELECT id FROM workflow_definitions WHERE target_kind = ? AND target_id = ?
)`, deletedAt, target.Kind, target.ID); err != nil {
		return fmt.Errorf("cancel retired workflow triggers: %w", err)
	}
	return nil
}

type workflowScanner interface {
	Scan(dest ...any) error
}

func scanWorkflowDefinition(scanner workflowScanner) (WorkflowDefinition, error) {
	var definition WorkflowDefinition
	var stepsJSON, triggerJSON, legacyTriggerKind string
	var nextDueAt sql.NullString
	if err := scanner.Scan(
		&definition.ID, &definition.Name, &definition.Target.Kind, &definition.Target.ID,
		&definition.ThreadID, &definition.Version, &legacyTriggerKind, &definition.TimeoutMS, &stepsJSON,
		&definition.CreatedAt, &definition.UpdatedAt, &triggerJSON, &nextDueAt,
	); errors.Is(err, sql.ErrNoRows) {
		return WorkflowDefinition{}, errors.New("workflow not found")
	} else if err != nil {
		return WorkflowDefinition{}, fmt.Errorf("scan workflow: %w", err)
	}
	var err error
	definition.Steps, err = decodeWorkflowSteps(stepsJSON)
	if err != nil {
		return WorkflowDefinition{}, err
	}
	definition.Trigger, err = decodeWorkflowTrigger(triggerJSON)
	if err != nil {
		return WorkflowDefinition{}, err
	}
	definition.NextDueAt = nullableString(nextDueAt)
	input := WorkflowDefinitionInput{
		ID: definition.ID, Name: definition.Name, Target: definition.Target,
		ThreadID: definition.ThreadID, Trigger: definition.Trigger, TimeoutMS: definition.TimeoutMS, Steps: definition.Steps,
	}
	if err := validateWorkflowDefinitionInput(input); err != nil {
		return WorkflowDefinition{}, fmt.Errorf("stored workflow failed validation: %w", err)
	}
	return definition, nil
}

func validateWorkflowThread(ctx context.Context, transaction *sql.Tx, target WorkflowTarget, threadID string) error {
	var kind, id string
	err := transaction.QueryRowContext(ctx, `
SELECT target_kind, target_id FROM conversation_threads
WHERE id = ? AND archived_at IS NULL`, threadID).Scan(&kind, &id)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("workflow conversation thread was not found or is archived")
	}
	if err != nil {
		return fmt.Errorf("validate workflow conversation thread: %w", err)
	}
	if kind != target.Kind || id != target.ID {
		return errors.New("workflow conversation thread does not belong to target")
	}
	return nil
}
