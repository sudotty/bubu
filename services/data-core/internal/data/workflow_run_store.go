package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func (service *Service) ListWorkflowRuns(
	ctx context.Context,
	workflowID string,
) ([]WorkflowRun, error) {
	if !objectID.MatchString(workflowID) {
		return nil, errors.New("workflow id is invalid")
	}
	rows, err := service.database.QueryContext(ctx, `
SELECT id, workflow_id, definition_version, idempotency_key, status,
       started_at, finished_at, error
FROM workflow_runs WHERE workflow_id = ?
ORDER BY started_at DESC, id DESC LIMIT 50`, workflowID)
	if err != nil {
		return nil, fmt.Errorf("list workflow runs: %w", err)
	}
	defer rows.Close()
	result := make([]WorkflowRun, 0)
	for rows.Next() {
		run, err := scanWorkflowRun(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, run)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workflow runs: %w", err)
	}
	for index := range result {
		result[index].Steps, err = service.loadWorkflowStepRuns(ctx, result[index].ID)
		if err != nil {
			return nil, err
		}
		if err := service.applyWorkflowApprovalState(ctx, &result[index]); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (service *Service) getWorkflowRunByIdempotency(
	ctx context.Context,
	workflowID string,
	idempotencyKey string,
) (*WorkflowRun, error) {
	row := service.database.QueryRowContext(ctx, `
SELECT id, workflow_id, definition_version, idempotency_key, status,
       started_at, finished_at, error
FROM workflow_runs WHERE workflow_id = ? AND idempotency_key = ?`, workflowID, idempotencyKey)
	run, err := scanWorkflowRun(row)
	if errors.Is(err, errWorkflowRunNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	run.Steps, err = service.loadWorkflowStepRuns(ctx, run.ID)
	if err == nil {
		err = service.applyWorkflowApprovalState(ctx, &run)
	}
	return &run, err
}

func (service *Service) getWorkflowRunByID(ctx context.Context, runID string) (WorkflowRun, error) {
	run, err := scanWorkflowRun(service.database.QueryRowContext(ctx, `
SELECT id, workflow_id, definition_version, idempotency_key, status, started_at, finished_at, error
FROM workflow_runs WHERE id = ?`, runID))
	if err != nil {
		return WorkflowRun{}, err
	}
	run.Steps, err = service.loadWorkflowStepRuns(ctx, run.ID)
	if err == nil {
		err = service.applyWorkflowApprovalState(ctx, &run)
	}
	return run, err
}

func (service *Service) applyWorkflowApprovalState(ctx context.Context, run *WorkflowRun) error {
	var ordinal int
	err := service.database.QueryRowContext(ctx, `SELECT ordinal FROM workflow_approval_requests WHERE run_id = ? AND status = 'pending'`, run.ID).Scan(&ordinal)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("load workflow approval state: %w", err)
	}
	markRunAwaitingApproval(run, ordinal)
	return nil
}

func markRunAwaitingApproval(run *WorkflowRun, ordinal int) {
	run.Status = "awaiting-approval"
	for index := range run.Steps {
		if run.Steps[index].Ordinal == ordinal && run.Steps[index].Status == "running" {
			run.Steps[index].Status = "awaiting-approval"
		}
	}
}

var errWorkflowRunNotFound = errors.New("workflow run not found")

func scanWorkflowRun(scanner workflowScanner) (WorkflowRun, error) {
	var run WorkflowRun
	var finishedAt sql.NullString
	var errorText sql.NullString
	if err := scanner.Scan(
		&run.ID, &run.WorkflowID, &run.DefinitionVersion, &run.IdempotencyKey,
		&run.Status, &run.StartedAt, &finishedAt, &errorText,
	); errors.Is(err, sql.ErrNoRows) {
		return WorkflowRun{}, errWorkflowRunNotFound
	} else if err != nil {
		return WorkflowRun{}, fmt.Errorf("scan workflow run: %w", err)
	}
	run.FinishedAt = nullableString(finishedAt)
	run.Error = nullableString(errorText)
	run.Steps = make([]WorkflowStepRun, 0)
	return run, nil
}

func (service *Service) loadWorkflowStepRuns(ctx context.Context, runID string) ([]WorkflowStepRun, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT id, step_id, ordinal, kind, status, attempt, started_at,
       finished_at, error, result_json
FROM workflow_step_runs WHERE run_id = ? ORDER BY ordinal, attempt`, runID)
	if err != nil {
		return nil, fmt.Errorf("list workflow step runs: %w", err)
	}
	defer rows.Close()
	result := make([]WorkflowStepRun, 0)
	for rows.Next() {
		var step WorkflowStepRun
		var finishedAt, errorText, resultJSON sql.NullString
		if err := rows.Scan(
			&step.ID, &step.StepID, &step.Ordinal, &step.Kind, &step.Status,
			&step.Attempt, &step.StartedAt, &finishedAt, &errorText, &resultJSON,
		); err != nil {
			return nil, fmt.Errorf("scan workflow step run: %w", err)
		}
		step.FinishedAt = nullableString(finishedAt)
		step.Error = nullableString(errorText)
		if resultJSON.Valid {
			artifact, err := decodeWorkflowStepResult(resultJSON.String)
			if err != nil {
				return nil, err
			}
			step.Result = &artifact
		}
		result = append(result, step)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workflow step runs: %w", err)
	}
	return result, nil
}
