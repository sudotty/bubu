package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

func validateBackupWorkflows(ctx context.Context, database *sql.DB, schemaVersion int) error {
	type backupWorkflow struct {
		input   WorkflowDefinitionInput
		deleted bool
	}

	query := `
SELECT id, name, target_kind, target_id, thread_id, timeout_ms, steps_json, deleted_at,
       trigger_json, next_due_at, target_signature
FROM workflow_definitions`
	if schemaVersion < 14 {
		query = `
SELECT id, name, target_kind, target_id, '', timeout_ms, steps_json, deleted_at,
       trigger_json, next_due_at, target_signature
FROM workflow_definitions`
	}
	if schemaVersion < 9 {
		query = `
SELECT id, name, target_kind, target_id, '', timeout_ms, steps_json, deleted_at,
       '{"kind":"manual"}', NULL, ''
FROM workflow_definitions`
	}
	rows, err := database.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("inspect backup workflows: %w", err)
	}
	defer rows.Close()
	workflows := make([]backupWorkflow, 0)
	for rows.Next() {
		var input WorkflowDefinitionInput
		var deletedAt sql.NullString
		var rawSteps, rawTrigger, targetSignature string
		var nextDueAt sql.NullString
		if err := rows.Scan(
			&input.ID, &input.Name, &input.Target.Kind, &input.Target.ID,
			&input.ThreadID, &input.TimeoutMS, &rawSteps, &deletedAt, &rawTrigger, &nextDueAt, &targetSignature,
		); err != nil {
			return fmt.Errorf("scan backup workflow: %w", err)
		}
		steps, err := decodeWorkflowSteps(rawSteps)
		if err != nil {
			return err
		}
		input.Steps = steps
		input.Trigger, err = decodeWorkflowTrigger(rawTrigger)
		if err != nil {
			return err
		}
		if schemaVersion < 14 {
			input.ThreadID = strings.Repeat("0", 32)
		}
		if err := validateWorkflowDefinitionInput(input); err != nil {
			_ = rows.Close()
			return fmt.Errorf("backup workflow definition is invalid: %w", err)
		}
		if err := validateBackupWorkflowTriggerState(input.Trigger, nextDueAt, targetSignature); err != nil {
			return err
		}
		workflows = append(workflows, backupWorkflow{input: input, deleted: deletedAt.Valid})
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("iterate backup workflows: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close backup workflow inspection: %w", err)
	}
	for _, workflow := range workflows {
		if workflow.deleted {
			continue
		}
		exists, err := backupWorkflowTargetExists(ctx, database, workflow.input.Target)
		if err != nil {
			return err
		}
		if !exists {
			return errors.New("backup contains an active workflow with no target")
		}
	}
	if err := validateBackupWorkflowRuns(ctx, database); err != nil {
		return err
	}
	if schemaVersion >= 9 {
		return validateBackupWorkflowTriggers(ctx, database)
	}
	return nil
}

func validateBackupWorkflowTriggerState(
	trigger WorkflowTrigger,
	nextDueAt sql.NullString,
	targetSignature string,
) error {
	if trigger.Kind == "manual" && (nextDueAt.Valid || targetSignature != "") {
		return errors.New("backup contains state for a manual workflow trigger")
	}
	if trigger.Kind == "interval" {
		if !nextDueAt.Valid || targetSignature != "" {
			return errors.New("backup interval workflow trigger state is invalid")
		}
		if _, err := time.Parse(time.RFC3339Nano, nextDueAt.String); err != nil {
			return errors.New("backup interval workflow due time is invalid")
		}
	}
	if trigger.Kind == "calendar" {
		if !nextDueAt.Valid || targetSignature != "" {
			return errors.New("backup calendar workflow trigger state is invalid")
		}
		if _, err := time.Parse(time.RFC3339Nano, nextDueAt.String); err != nil {
			return errors.New("backup calendar workflow due time is invalid")
		}
	}
	if trigger.Kind == "dataset-version" && (nextDueAt.Valid || !validSHA256(targetSignature)) {
		return errors.New("backup dataset-version workflow signature is invalid")
	}
	return nil
}

func validateBackupWorkflowRuns(ctx context.Context, database *sql.DB) error {
	var excessiveRuns int
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT workflow_id FROM workflow_runs GROUP BY workflow_id HAVING COUNT(*) > ?
)`, maximumWorkflowRuns).Scan(&excessiveRuns); err != nil || excessiveRuns != 0 {
		return errors.New("backup exceeds the workflow run audit limit")
	}
	var excessiveAttempts int
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT run_id FROM workflow_step_runs GROUP BY run_id HAVING COUNT(*) > ?
)`, maximumWorkflowSteps*maximumWorkflowAttempts).Scan(&excessiveAttempts); err != nil || excessiveAttempts != 0 {
		return errors.New("backup exceeds the workflow checkpoint limit")
	}
	runs, err := database.QueryContext(ctx, `
SELECT r.idempotency_key, r.definition_version, r.status, r.finished_at, r.error, d.version
FROM workflow_runs r JOIN workflow_definitions d ON d.id = r.workflow_id`)
	if err != nil {
		return fmt.Errorf("inspect backup workflow runs: %w", err)
	}
	defer runs.Close()
	for runs.Next() {
		var key, status string
		var definitionVersion, currentVersion int
		var finishedAt, errorText sql.NullString
		if err := runs.Scan(&key, &definitionVersion, &status, &finishedAt, &errorText, &currentVersion); err != nil {
			return fmt.Errorf("scan backup workflow run: %w", err)
		}
		if !workflowIdempotencyKey.MatchString(key) || definitionVersion < 1 || definitionVersion > currentVersion {
			return errors.New("backup contains an invalid workflow run identity")
		}
		if status == "running" || !finishedAt.Valid {
			return errors.New("backup contains a non-terminal workflow run")
		}
		if status == "succeeded" && errorText.Valid {
			return errors.New("backup contains an inconsistent successful workflow run")
		}
		if (status == "failed" || status == "cancelled") && (!errorText.Valid || len(errorText.String) > 2_000) {
			return errors.New("backup contains an inconsistent unsuccessful workflow run")
		}
		if status != "succeeded" && status != "failed" && status != "cancelled" {
			return errors.New("backup contains an invalid workflow run status")
		}
	}
	if err := runs.Err(); err != nil {
		return fmt.Errorf("iterate backup workflow runs: %w", err)
	}
	if err := runs.Close(); err != nil {
		return fmt.Errorf("close backup workflow run inspection: %w", err)
	}
	return validateBackupWorkflowSteps(ctx, database)
}

func validateBackupWorkflowSteps(ctx context.Context, database *sql.DB) error {
	steps, err := database.QueryContext(ctx, `
SELECT kind, status, attempt, resolved_input_json, result_json, finished_at, error
FROM workflow_step_runs`)
	if err != nil {
		return fmt.Errorf("inspect backup workflow steps: %w", err)
	}
	defer steps.Close()
	for steps.Next() {
		var kind, status, rawInput string
		var attempt int
		var rawResult, finishedAt, errorText sql.NullString
		if err := steps.Scan(&kind, &status, &attempt, &rawInput, &rawResult, &finishedAt, &errorText); err != nil {
			return fmt.Errorf("scan backup workflow step: %w", err)
		}
		if attempt < 1 || attempt > maximumWorkflowAttempts || validateWorkflowResolvedInput(kind, rawInput) != nil {
			return errors.New("backup contains an invalid workflow step input")
		}
		if status == "running" || !finishedAt.Valid {
			return errors.New("backup contains a non-terminal workflow step")
		}
		if status == "succeeded" {
			if errorText.Valid || !rawResult.Valid {
				return errors.New("backup contains an inconsistent successful workflow step")
			}
			result, err := decodeWorkflowStepResult(rawResult.String)
			if err != nil || result.Kind != kind {
				return errors.New("backup contains an invalid workflow step result")
			}
		} else if status == "failed" || status == "cancelled" {
			if !errorText.Valid || len(errorText.String) > 2_000 || rawResult.Valid {
				return errors.New("backup contains an inconsistent unsuccessful workflow step")
			}
		} else {
			return errors.New("backup contains an invalid workflow step status")
		}
	}
	if err := steps.Err(); err != nil {
		return fmt.Errorf("iterate backup workflow steps: %w", err)
	}
	return nil
}

func validateBackupWorkflowTriggers(ctx context.Context, database *sql.DB) error {
	var invalid int
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT workflow_id FROM workflow_trigger_events
  GROUP BY workflow_id HAVING COUNT(*) > ?
)`, maximumWorkflowTriggerEvents).Scan(&invalid); err != nil || invalid != 0 {
		return errors.New("backup exceeds the workflow trigger event limit")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM workflow_trigger_events events
JOIN workflow_definitions definitions ON definitions.id = events.workflow_id
LEFT JOIN workflow_runs runs ON runs.id = events.run_id
WHERE length(events.dedupe_key) > 200
   OR events.definition_version > definitions.version
   OR (events.status = 'pending' AND events.definition_version <> definitions.version)
   OR (events.run_id IS NOT NULL AND runs.workflow_id <> events.workflow_id)`).Scan(&invalid); err != nil || invalid != 0 {
		return errors.New("backup contains inconsistent workflow trigger references")
	}
	rows, err := database.QueryContext(ctx, workflowTriggerEventSelect)
	if err != nil {
		return fmt.Errorf("inspect backup workflow triggers: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		event, err := scanWorkflowTriggerEvent(rows)
		if err != nil || validateWorkflowTriggerEvent(event) != nil {
			return errors.New("backup contains an invalid workflow trigger event")
		}
	}
	return rows.Err()
}

func backupWorkflowTargetExists(
	ctx context.Context,
	database *sql.DB,
	target WorkflowTarget,
) (bool, error) {
	table := "datasets"
	if target.Kind == "group" {
		table = "dataset_groups"
	}
	var exists int
	err := database.QueryRowContext(ctx, "SELECT 1 FROM "+table+" WHERE id = ?", target.ID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("validate backup workflow target: %w", err)
	}
	return true, nil
}
