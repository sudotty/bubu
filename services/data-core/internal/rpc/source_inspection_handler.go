package rpc

import "context"

func handleSourceInspection(ctx context.Context, request Request, datasets DatasetService) Response {
	sourcePath, ok := stringParam(request.Params, "sourcePath")
	if !ok {
		return failure(request.ID, "INVALID_ARGUMENT", "sourcePath is required", false)
	}
	result, err := datasets.InspectSource(ctx, sourcePath)
	if err != nil {
		return failure(request.ID, "SOURCE_INSPECTION_FAILED", err.Error(), false)
	}
	return success(request.ID, result)
}
