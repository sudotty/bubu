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

func (service *Service) FinishWorkflowTrigger(
	ctx context.Context,
	input WorkflowTriggerFinishInput,
) (WorkflowTriggerEvent, error) {
	if err := validateWorkflowTriggerFinish(input); err != nil {
		return WorkflowTriggerEvent{}, err
	}
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return WorkflowTriggerEvent{}, fmt.Errorf("begin workflow trigger finish: %w", err)
	}
	defer transaction.Rollback()
	var workflowID string
	var target ConversationTarget
	if err := transaction.QueryRowContext(ctx, `
SELECT events.workflow_id, definitions.target_kind, definitions.target_id
FROM workflow_trigger_events events
JOIN workflow_definitions definitions ON definitions.id = events.workflow_id
WHERE events.id = ? AND events.status = 'pending'`, input.ID).Scan(
		&workflowID, &target.Kind, &target.ID,
	); errors.Is(err, sql.ErrNoRows) {
		return WorkflowTriggerEvent{}, errors.New("workflow trigger was not pending")
	} else if err != nil {
		return WorkflowTriggerEvent{}, fmt.Errorf("load pending workflow trigger: %w", err)
	}
	entry, err := triggeredWorkflowConversationEntry(ctx, transaction, workflowID, input)
	if err != nil {
		return WorkflowTriggerEvent{}, err
	}
	if err := appendExistingConversationEntry(ctx, transaction, target, entry, finishedAt); err != nil {
		return WorkflowTriggerEvent{}, err
	}
	result, err := transaction.ExecContext(ctx, `
UPDATE workflow_trigger_events AS events
SET status = ?, run_id = ?, error = ?, finished_at = ?
WHERE events.id = ? AND events.status = 'pending'`,
		input.Status, input.RunID, input.Error, finishedAt, input.ID)
	if err != nil {
		return WorkflowTriggerEvent{}, fmt.Errorf("finish workflow trigger: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return WorkflowTriggerEvent{}, errors.New("workflow trigger was not pending")
	}
	if err := transaction.Commit(); err != nil {
		return WorkflowTriggerEvent{}, fmt.Errorf("commit workflow trigger finish: %w", err)
	}
	return service.getWorkflowTriggerEvent(ctx, input.ID)
}

func triggeredWorkflowConversationEntry(
	ctx context.Context,
	transaction *sql.Tx,
	workflowID string,
	input WorkflowTriggerFinishInput,
) (ConversationEntryInput, error) {
	if input.RunID == nil {
		payload, _ := json.Marshal(map[string]string{"message": *input.Error})
		return ConversationEntryInput{Kind: "error", Role: "system", Payload: payload}, nil
	}
	var runStatus string
	var runError sql.NullString
	if err := transaction.QueryRowContext(ctx, `
SELECT status, error FROM workflow_runs WHERE id = ? AND workflow_id = ?`,
		*input.RunID, workflowID).Scan(&runStatus, &runError); errors.Is(err, sql.ErrNoRows) {
		return ConversationEntryInput{}, errors.New("workflow trigger run did not match")
	} else if err != nil {
		return ConversationEntryInput{}, fmt.Errorf("load workflow trigger run: %w", err)
	}
	if runStatus != input.Status {
		return ConversationEntryInput{}, errors.New("workflow trigger status does not match its run")
	}
	if input.Status != "succeeded" {
		if !runError.Valid || input.Error == nil || runError.String != *input.Error {
			return ConversationEntryInput{}, errors.New("workflow trigger error does not match its run")
		}
		payload, _ := json.Marshal(map[string]string{"message": runError.String})
		return ConversationEntryInput{Kind: "error", Role: "system", Payload: payload}, nil
	}
	var kind, rawInput, rawResult string
	if err := transaction.QueryRowContext(ctx, `
SELECT kind, resolved_input_json, result_json FROM workflow_step_runs
WHERE run_id = ? AND status = 'succeeded' AND result_json IS NOT NULL
ORDER BY ordinal DESC, attempt DESC LIMIT 1`, *input.RunID).Scan(&kind, &rawInput, &rawResult); err != nil {
		return ConversationEntryInput{}, errors.New("successful workflow trigger has no result artifact")
	}
	artifact, err := decodeWorkflowStepResult(rawResult)
	if err != nil {
		return ConversationEntryInput{}, err
	}
	if artifact.Kind != kind || validateWorkflowResolvedInput(kind, rawInput) != nil {
		return ConversationEntryInput{}, errors.New("successful workflow trigger has an invalid source plan")
	}
	payload, err := json.Marshal(map[string]any{
		"result":     artifact.Value,
		"sourcePlan": json.RawMessage(rawInput),
	})
	if err != nil {
		return ConversationEntryInput{}, errors.New("encode triggered workflow result")
	}
	return ConversationEntryInput{Kind: "result", Role: "assistant", Payload: payload}, nil
}

func validateWorkflowTriggerFinish(input WorkflowTriggerFinishInput) error {
	if !objectID.MatchString(input.ID) ||
		(input.Status != "succeeded" && input.Status != "failed" && input.Status != "cancelled") {
		return errors.New("workflow trigger finish identity or status is invalid")
	}
	if input.RunID != nil && !objectID.MatchString(*input.RunID) {
		return errors.New("workflow trigger run identity is invalid")
	}
	if input.Status == "succeeded" && (input.RunID == nil || input.Error != nil) {
		return errors.New("successful workflow trigger requires only its run identity")
	}
	if input.Status != "succeeded" && (input.Error == nil || strings.TrimSpace(*input.Error) == "" || len(*input.Error) > 2_000) {
		return errors.New("unsuccessful workflow trigger requires a bounded error")
	}
	return nil
}

const workflowTriggerEventSelect = `SELECT
  events.id, events.workflow_id, events.definition_version, events.operation_id,
  definitions.target_kind, definitions.target_id, events.trigger_kind,
  events.due_at, events.status, events.run_id, events.error,
  events.created_at, events.finished_at
FROM workflow_trigger_events events
JOIN workflow_definitions definitions ON definitions.id = events.workflow_id `

func (service *Service) getWorkflowTriggerEvent(ctx context.Context, id string) (WorkflowTriggerEvent, error) {
	return scanWorkflowTriggerEvent(service.database.QueryRowContext(ctx,
		workflowTriggerEventSelect+"WHERE events.id = ?", id))
}

func scanWorkflowTriggerEvent(scanner workflowScanner) (WorkflowTriggerEvent, error) {
	var event WorkflowTriggerEvent
	var runID, errorText, finishedAt sql.NullString
	if err := scanner.Scan(
		&event.ID, &event.WorkflowID, &event.DefinitionVersion, &event.OperationID,
		&event.Target.Kind, &event.Target.ID, &event.TriggerKind,
		&event.DueAt, &event.Status, &runID, &errorText,
		&event.CreatedAt, &finishedAt,
	); errors.Is(err, sql.ErrNoRows) {
		return WorkflowTriggerEvent{}, errors.New("workflow trigger event not found")
	} else if err != nil {
		return WorkflowTriggerEvent{}, fmt.Errorf("scan workflow trigger event: %w", err)
	}
	event.RunID = nullableString(runID)
	event.Error = nullableString(errorText)
	event.FinishedAt = nullableString(finishedAt)
	if err := validateWorkflowTriggerEvent(event); err != nil {
		return WorkflowTriggerEvent{}, err
	}
	return event, nil
}

func validateWorkflowTriggerEvent(event WorkflowTriggerEvent) error {
	if !objectID.MatchString(event.ID) || !objectID.MatchString(event.WorkflowID) ||
		event.DefinitionVersion < 1 || !workflowIdempotencyKey.MatchString(event.OperationID) ||
		(event.Target.Kind != "dataset" && event.Target.Kind != "group") || !objectID.MatchString(event.Target.ID) ||
		(event.TriggerKind != "interval" && event.TriggerKind != "dataset-version") {
		return errors.New("stored workflow trigger identity is invalid")
	}
	if _, err := time.Parse(time.RFC3339Nano, event.DueAt); err != nil {
		return errors.New("stored workflow trigger due time is invalid")
	}
	if _, err := time.Parse(time.RFC3339Nano, event.CreatedAt); err != nil {
		return errors.New("stored workflow trigger creation time is invalid")
	}
	if event.Status == "pending" {
		if event.RunID != nil || event.Error != nil || event.FinishedAt != nil {
			return errors.New("pending workflow trigger contains terminal fields")
		}
		return nil
	}
	if event.Status != "succeeded" && event.Status != "failed" && event.Status != "cancelled" {
		return errors.New("stored workflow trigger status is invalid")
	}
	if event.FinishedAt == nil {
		return errors.New("terminal workflow trigger has no finish time")
	}
	if _, err := time.Parse(time.RFC3339Nano, *event.FinishedAt); err != nil {
		return errors.New("stored workflow trigger finish time is invalid")
	}
	if event.RunID != nil && !objectID.MatchString(*event.RunID) {
		return errors.New("stored workflow trigger run identity is invalid")
	}
	if event.Status == "succeeded" && (event.RunID == nil || event.Error != nil) {
		return errors.New("stored successful workflow trigger is inconsistent")
	}
	if event.Status != "succeeded" && (event.Error == nil || strings.TrimSpace(*event.Error) == "" || len(*event.Error) > 2_000) {
		return errors.New("stored unsuccessful workflow trigger is inconsistent")
	}
	return nil
}

func cancelPendingWorkflowTriggers(
	ctx context.Context,
	transaction *sql.Tx,
	workflowID string,
	reason string,
	finishedAt string,
) error {
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_trigger_events
SET status = 'cancelled', error = ?, finished_at = ?
WHERE workflow_id = ? AND status = 'pending'`, reason, finishedAt, workflowID); err != nil {
		return fmt.Errorf("cancel pending workflow triggers: %w", err)
	}
	return nil
}
