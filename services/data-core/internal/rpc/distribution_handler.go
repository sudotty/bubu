package rpc

import "context"

func handleDistribution(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	if request.Method != "dataset.distribution.get" {
		return Response{}, false
	}
	datasetID, idOK := stringParam(request.Params, "datasetId")
	column, columnOK := stringParam(request.Params, "column")
	if !idOK || !columnOK {
		return failure(request.ID, "INVALID_ARGUMENT", "datasetId and column are required", false), true
	}
	result, err := datasets.GetColumnDistribution(ctx, datasetID, column)
	if err != nil {
		return failure(request.ID, "DISTRIBUTION_FAILED", err.Error(), false), true
	}
	return success(request.ID, result), true
}
