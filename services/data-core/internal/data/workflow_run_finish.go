package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

func (service *Service) finishWorkflowStepRun(
	ctx context.Context,
	stepRunID string,
	status string,
	artifact *WorkflowStepResult,
	executionErr error,
) error {
	var resultJSON any
	if executionErr == nil {
		encoded, err := json.Marshal(artifact)
		if err != nil || len(encoded) > maximumWorkflowJSONBytes {
			return errors.New("workflow result exceeds its persistence budget")
		}
		resultJSON = string(encoded)
	}
	var errorText any
	if executionErr != nil {
		errorText = boundedWorkflowError(executionErr)
	}
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	result, err := service.database.ExecContext(ctx, `
UPDATE workflow_step_runs
SET status = ?, result_json = ?, error = ?, finished_at = ?
WHERE id = ? AND status = 'running'`, status, resultJSON, errorText, finishedAt, stepRunID)
	if err != nil {
		return fmt.Errorf("finish workflow step: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return errors.New("workflow step checkpoint was not active")
	}
	return nil
}

func (service *Service) recordUnresolvedWorkflowStep(
	ctx context.Context,
	runID string,
	ordinal int,
	step WorkflowStepDefinition,
	attempt int,
	resolvedInput any,
	status string,
	executionErr error,
) error {
	stepRun, err := service.startWorkflowStepRun(ctx, runID, ordinal, step, attempt, resolvedInput)
	if err != nil {
		return err
	}
	return service.finishWorkflowStepRun(ctx, stepRun.ID, status, nil, executionErr)
}

func (service *Service) finishWorkflowRun(
	ctx context.Context,
	run WorkflowRun,
	status string,
	executionErr error,
) (WorkflowRun, error) {
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	var errorText any
	if executionErr != nil {
		errorText = boundedWorkflowError(executionErr)
	}
	result, err := service.database.ExecContext(ctx, `
UPDATE workflow_runs SET status = ?, finished_at = ?, error = ?
WHERE id = ? AND status = 'running'`, status, finishedAt, errorText, run.ID)
	if err != nil {
		return WorkflowRun{}, fmt.Errorf("finish workflow run: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return WorkflowRun{}, errors.New("workflow run was not active")
	}
	loaded, err := service.getWorkflowRunByIdempotency(ctx, run.WorkflowID, run.IdempotencyKey)
	if err != nil {
		return WorkflowRun{}, err
	}
	if loaded == nil {
		return WorkflowRun{}, errors.New("finished workflow run disappeared")
	}
	return *loaded, nil
}

func boundedWorkflowError(err error) string {
	runes := []rune(err.Error())
	if len(runes) > 2_000 {
		runes = runes[:2_000]
	}
	return string(runes)
}
