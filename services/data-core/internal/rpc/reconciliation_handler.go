package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func handleReconciliation(ctx context.Context, request Request, datasets DatasetService) (Response, bool) {
	switch request.Method {
	case "reconciliation.preview":
		plan, ok := objectParam[data.ReconciliationPlan](request.Params, "plan")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "plan must be one strict reconciliation plan", false), true
		}
		result, err := datasets.PreviewReconciliation(ctx, plan)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_PREVIEW_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.execute":
		plan, planOK := objectParam[data.ReconciliationPlan](request.Params, "plan")
		review, reviewOK := objectParam[data.ReconciliationReview](request.Params, "review")
		if !planOK || !reviewOK {
			return failure(request.ID, "INVALID_ARGUMENT", "plan and strict review are required", false), true
		}
		result, err := datasets.ExecuteReconciliation(ctx, plan, review)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_EXECUTION_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.artifact.get":
		id, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "artifact id is required", false), true
		}
		result, err := datasets.GetReconciliationArtifact(ctx, id)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_ARTIFACT_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.definition.save":
		artifactID, ok := stringParam(request.Params, "artifactId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "artifactId is required", false), true
		}
		result, err := datasets.SaveReconciliationDefinition(ctx, artifactID)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_DEFINITION_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.artifacts.list":
		datasetIDs, ok := stringSliceParam(request.Params, "datasetIds", 8)
		if !ok || len(datasetIDs) == 0 {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetIds must contain 1 to 8 ids", false), true
		}
		result, err := datasets.ListReconciliationArtifacts(ctx, datasetIDs)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_ARTIFACTS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.replay.process":
		result, err := datasets.ProcessReconciliationReplayEvents(ctx)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_REPLAY_PROCESS_FAILED", err.Error(), true), true
		}
		return success(request.ID, result), true
	case "reconciliation.replay.events":
		datasetIDs, ok := stringSliceParam(request.Params, "datasetIds", 8)
		if !ok || len(datasetIDs) == 0 {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetIds must contain 1 to 8 ids", false), true
		}
		result, err := datasets.ListReconciliationReplayEvents(ctx, datasetIDs)
		if err != nil {
			return failure(request.ID, "RECONCILIATION_REPLAY_EVENTS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "reconciliation.replay.retry", "reconciliation.replay.cancel":
		id, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "id is required", false), true
		}
		var result data.ReconciliationReplayEvent
		var err error
		if request.Method == "reconciliation.replay.retry" {
			result, err = datasets.RetryReconciliationReplayEvent(ctx, id)
		} else {
			result, err = datasets.CancelReconciliationReplayEvent(ctx, id)
		}
		if err != nil {
			return failure(request.ID, "RECONCILIATION_REPLAY_TRANSITION_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
