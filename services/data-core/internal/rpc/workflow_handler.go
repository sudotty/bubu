package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type workflowService interface {
	SaveWorkflow(context.Context, data.WorkflowDefinitionInput) (data.WorkflowDefinition, error)
	ListWorkflows(context.Context, *data.WorkflowTarget) ([]data.WorkflowDefinition, error)
	DeleteWorkflow(context.Context, string) error
	RunWorkflow(context.Context, string, string) (data.WorkflowRun, error)
	ListWorkflowRuns(context.Context, string) ([]data.WorkflowRun, error)
	ClaimDueWorkflowTriggers(context.Context, string) ([]data.WorkflowTriggerEvent, error)
	FinishWorkflowTrigger(context.Context, data.WorkflowTriggerFinishInput) (data.WorkflowTriggerEvent, error)
}

func handleWorkflow(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	workflows, ok := datasets.(workflowService)
	if !ok {
		return Response{}, false
	}
	switch request.Method {
	case "workflow.save":
		input, ok := objectParam[data.WorkflowDefinitionInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a strict bounded workflow definition", false), true
		}
		result, err := workflows.SaveWorkflow(ctx, input)
		if err != nil {
			return failure(request.ID, "WORKFLOW_SAVE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "workflow.list":
		var target *data.WorkflowTarget
		if _, exists := request.Params["target"]; exists {
			value, ok := objectParam[data.WorkflowTarget](request.Params, "target")
			if !ok {
				return failure(request.ID, "INVALID_ARGUMENT", "workflow target is invalid", false), true
			}
			target = &value
		}
		result, err := workflows.ListWorkflows(ctx, target)
		if err != nil {
			return failure(request.ID, "WORKFLOW_ACCESS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "workflow.delete":
		workflowID, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "workflow id is required", false), true
		}
		if err := workflows.DeleteWorkflow(ctx, workflowID); err != nil {
			return failure(request.ID, "WORKFLOW_DELETE_FAILED", err.Error(), false), true
		}
		return success(request.ID, map[string]bool{"deleted": true}), true
	case "workflow.run":
		workflowID, idOK := stringParam(request.Params, "id")
		idempotencyKey, keyOK := stringParam(request.Params, "idempotencyKey")
		if !idOK || !keyOK {
			return failure(request.ID, "INVALID_ARGUMENT", "workflow id and idempotency key are required", false), true
		}
		result, err := workflows.RunWorkflow(ctx, workflowID, idempotencyKey)
		if err != nil {
			return failure(request.ID, "WORKFLOW_RUN_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "workflow.runs.list":
		workflowID, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "workflow id is required", false), true
		}
		result, err := workflows.ListWorkflowRuns(ctx, workflowID)
		if err != nil {
			return failure(request.ID, "WORKFLOW_RUN_ACCESS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "workflow.triggers.claim":
		now, ok := stringParam(request.Params, "now")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "trigger clock is required", false), true
		}
		result, err := workflows.ClaimDueWorkflowTriggers(ctx, now)
		if err != nil {
			return failure(request.ID, "WORKFLOW_TRIGGER_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "workflow.triggers.finish":
		input, ok := objectParam[data.WorkflowTriggerFinishInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "trigger completion is invalid", false), true
		}
		result, err := workflows.FinishWorkflowTrigger(ctx, input)
		if err != nil {
			return failure(request.ID, "WORKFLOW_TRIGGER_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
