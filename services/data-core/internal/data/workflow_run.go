package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

func (service *Service) RunWorkflow(
	ctx context.Context,
	workflowID string,
	idempotencyKey string,
) (WorkflowRun, error) {
	if !objectID.MatchString(workflowID) || !workflowIdempotencyKey.MatchString(idempotencyKey) {
		return WorkflowRun{}, errors.New("workflow run identity is invalid")
	}
	existing, err := service.getWorkflowRunByIdempotency(ctx, workflowID, idempotencyKey)
	if err != nil {
		return WorkflowRun{}, err
	}
	if existing != nil {
		return *existing, nil
	}
	definition, err := service.GetWorkflow(ctx, workflowID)
	if err != nil {
		return WorkflowRun{}, err
	}
	run, err := service.startWorkflowRun(ctx, definition, idempotencyKey)
	if err != nil {
		return WorkflowRun{}, err
	}
	runContext, cancel := context.WithTimeout(ctx, time.Duration(definition.TimeoutMS)*time.Millisecond)
	defer cancel()
	return service.executeWorkflowRun(runContext, context.WithoutCancel(ctx), run, definition)
}

func (service *Service) executeWorkflowRun(
	runContext context.Context,
	persistenceContext context.Context,
	run WorkflowRun,
	definition WorkflowDefinition,
) (WorkflowRun, error) {
	for ordinal, step := range definition.Steps {
		if runContext.Err() != nil {
			status := workflowFailureStatus(runContext.Err())
			if err := service.recordUnresolvedWorkflowStep(
				persistenceContext, run.ID, ordinal, step, 1, workflowStepInput(step), status, runContext.Err(),
			); err != nil {
				return WorkflowRun{}, err
			}
			return service.finishWorkflowRun(persistenceContext, run, status, runContext.Err())
		}
		resolved, err := service.resolveWorkflowStep(runContext, step)
		if err != nil {
			status := "failed"
			terminalError := err
			if runContext.Err() != nil {
				status = workflowFailureStatus(runContext.Err())
				terminalError = runContext.Err()
			}
			if recordErr := service.recordUnresolvedWorkflowStep(
				persistenceContext, run.ID, ordinal, step, 1, workflowStepInput(step), status, terminalError,
			); recordErr != nil {
				return WorkflowRun{}, recordErr
			}
			return service.finishWorkflowRun(persistenceContext, run, status, terminalError)
		}
		completed := false
		for attempt := 1; attempt <= step.MaximumAttempts; attempt++ {
			stepRun, err := service.startWorkflowStepRun(runContext, run.ID, ordinal, step, attempt, resolved.input)
			if err != nil {
				status := "failed"
				terminalError := err
				if runContext.Err() != nil {
					status = workflowFailureStatus(runContext.Err())
					terminalError = runContext.Err()
				}
				if recordErr := service.recordUnresolvedWorkflowStep(
					persistenceContext, run.ID, ordinal, step, attempt, resolved.input, status, terminalError,
				); recordErr != nil {
					return WorkflowRun{}, errors.Join(err, recordErr)
				}
				return service.finishWorkflowRun(persistenceContext, run, status, terminalError)
			}
			artifact, executionErr := resolved.execute(runContext)
			status := "succeeded"
			if executionErr != nil {
				status = "failed"
				if runContext.Err() != nil {
					status = workflowFailureStatus(runContext.Err())
				}
			}
			if err := service.finishWorkflowStepRun(
				persistenceContext, stepRun.ID, status, artifact, executionErr,
			); err != nil {
				return WorkflowRun{}, err
			}
			if executionErr == nil {
				completed = true
				break
			}
			if runContext.Err() != nil {
				return service.finishWorkflowRun(persistenceContext, run, workflowFailureStatus(runContext.Err()), runContext.Err())
			}
			if attempt == step.MaximumAttempts {
				return service.finishWorkflowRun(persistenceContext, run, "failed", executionErr)
			}
		}
		if !completed {
			return service.finishWorkflowRun(persistenceContext, run, "failed", errors.New("workflow step did not complete"))
		}
	}
	return service.finishWorkflowRun(persistenceContext, run, "succeeded", nil)
}

func workflowStepInput(step WorkflowStepDefinition) any {
	if step.Plan != nil {
		return *step.Plan
	}
	if step.GroupPlan != nil {
		return *step.GroupPlan
	}
	return struct{}{}
}

func workflowFailureStatus(err error) string {
	if errors.Is(err, context.Canceled) {
		return "cancelled"
	}
	return "failed"
}

func (service *Service) startWorkflowRun(
	ctx context.Context,
	definition WorkflowDefinition,
	idempotencyKey string,
) (WorkflowRun, error) {
	var count int
	if err := service.database.QueryRowContext(ctx, "SELECT COUNT(*) FROM workflow_runs WHERE workflow_id = ?", definition.ID).Scan(&count); err != nil {
		return WorkflowRun{}, fmt.Errorf("count workflow runs: %w", err)
	}
	if count >= maximumWorkflowRuns {
		return WorkflowRun{}, fmt.Errorf("workflow reached the %d-run local audit limit", maximumWorkflowRuns)
	}
	runID, err := newID()
	if err != nil {
		return WorkflowRun{}, err
	}
	startedAt := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := service.database.ExecContext(ctx, `
INSERT INTO workflow_runs(
  id, workflow_id, definition_version, idempotency_key, status, started_at
) VALUES (?, ?, ?, ?, 'running', ?)`,
		runID, definition.ID, definition.Version, idempotencyKey, startedAt); err != nil {
		return WorkflowRun{}, fmt.Errorf("start workflow run: %w", err)
	}
	return WorkflowRun{
		ID: runID, WorkflowID: definition.ID, DefinitionVersion: definition.Version,
		IdempotencyKey: idempotencyKey, Status: "running", StartedAt: startedAt,
		Steps: make([]WorkflowStepRun, 0),
	}, nil
}

type resolvedWorkflowStep struct {
	input   any
	execute func(context.Context) (*WorkflowStepResult, error)
}

func (service *Service) resolveWorkflowStep(
	ctx context.Context,
	step WorkflowStepDefinition,
) (resolvedWorkflowStep, error) {
	if step.Kind == "dataset-query" && step.Plan != nil {
		plan := *step.Plan
		if err := service.database.QueryRowContext(ctx, `
SELECT current_version_id FROM datasets WHERE id = ?`, plan.DatasetID).Scan(&plan.VersionID); err != nil {
			return resolvedWorkflowStep{}, errors.New("workflow dataset is unavailable")
		}
		return resolvedWorkflowStep{input: plan, execute: func(runContext context.Context) (*WorkflowStepResult, error) {
			result, err := service.ExecuteQueryPlan(runContext, plan)
			return &WorkflowStepResult{Kind: step.Kind, Value: result}, err
		}}, nil
	}
	if step.Kind == "group-query" && step.GroupPlan != nil {
		plan := *step.GroupPlan
		group, err := service.GetGroup(ctx, plan.GroupID)
		if err != nil || len(group.Members) != len(plan.Sources) {
			return resolvedWorkflowStep{}, errors.New("workflow group membership is unavailable or changed")
		}
		plan.Sources = append([]GroupQuerySource(nil), plan.Sources...)
		for index, member := range group.Members {
			if plan.Sources[index].DatasetID != member.ID {
				return resolvedWorkflowStep{}, errors.New("workflow group membership order changed")
			}
			plan.Sources[index].VersionID = member.VersionID
		}
		return resolvedWorkflowStep{input: plan, execute: func(runContext context.Context) (*WorkflowStepResult, error) {
			result, err := service.ExecuteGroupQueryPlan(runContext, plan)
			return &WorkflowStepResult{Kind: step.Kind, Value: result}, err
		}}, nil
	}
	return resolvedWorkflowStep{}, errors.New("workflow step kind is unsupported")
}

func (service *Service) startWorkflowStepRun(
	ctx context.Context,
	runID string,
	ordinal int,
	step WorkflowStepDefinition,
	attempt int,
	resolvedInput any,
) (WorkflowStepRun, error) {
	inputJSON, err := json.Marshal(resolvedInput)
	if err != nil || len(inputJSON) > maximumWorkflowJSONBytes {
		return WorkflowStepRun{}, errors.New("resolved workflow input exceeds its budget")
	}
	stepRunID, err := newID()
	if err != nil {
		return WorkflowStepRun{}, err
	}
	startedAt := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := service.database.ExecContext(ctx, `
INSERT INTO workflow_step_runs(
  id, run_id, step_id, ordinal, kind, status, attempt, resolved_input_json, started_at
) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
		stepRunID, runID, step.ID, ordinal, step.Kind, attempt, string(inputJSON), startedAt); err != nil {
		return WorkflowStepRun{}, fmt.Errorf("start workflow step: %w", err)
	}
	return WorkflowStepRun{
		ID: stepRunID, StepID: step.ID, Ordinal: ordinal, Kind: step.Kind,
		Status: "running", Attempt: attempt, StartedAt: startedAt,
	}, nil
}
