package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func handleDerivedDataset(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	switch request.Method {
	case "dataset.clean.preview":
		plan, ok := objectParam[data.DataCleanPlan](request.Params, "plan")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "plan must be a strict data-clean plan", false), true
		}
		policy, ok := objectParam[data.DataCleanQualityPolicy](request.Params, "qualityPolicy")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "qualityPolicy must be a strict data-clean quality policy", false), true
		}
		result, err := datasets.PreviewDataCleanPlan(ctx, plan, policy)
		if err != nil {
			return failure(request.ID, "DATA_CLEAN_PREVIEW_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.materialize":
		input, ok := objectParam[data.DerivedDatasetCreateInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must contain a name and one strict transformation plan", false), true
		}
		result, err := datasets.MaterializeDerivedDataset(ctx, input)
		if err != nil {
			return failure(request.ID, "DERIVED_MATERIALIZATION_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.recompute":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false), true
		}
		result, err := datasets.RecomputeDerivedDataset(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DERIVED_RECOMPUTE_REJECTED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.lineage":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false), true
		}
		result, err := datasets.GetDerivedDatasetLineage(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DERIVED_LINEAGE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.dependencies":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false), true
		}
		result, err := datasets.GetDerivedDependencyPlan(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DERIVED_DEPENDENCIES_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.recompute.process":
		result, err := datasets.ProcessDerivedRecomputeEvents(ctx)
		if err != nil {
			return failure(request.ID, "DERIVED_RECOMPUTE_PROCESS_FAILED", err.Error(), true), true
		}
		return success(request.ID, result), true
	case "dataset.derived.recompute.events":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false), true
		}
		result, err := datasets.ListDerivedRecomputeEvents(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DERIVED_RECOMPUTE_EVENTS_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.recompute.retry":
		id, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "id is required", false), true
		}
		result, err := datasets.RetryDerivedRecomputeEvent(ctx, id)
		if err != nil {
			return failure(request.ID, "DERIVED_RECOMPUTE_RETRY_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.derived.recompute.cancel":
		id, ok := stringParam(request.Params, "id")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "id is required", false), true
		}
		result, err := datasets.CancelDerivedRecomputeEvent(ctx, id)
		if err != nil {
			return failure(request.ID, "DERIVED_RECOMPUTE_CANCEL_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
