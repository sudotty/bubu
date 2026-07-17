package rpc

import "context"

func handleDatasetLifecycle(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	switch request.Method {
	case "dataset.export":
		datasetID, idOK := stringParam(request.Params, "datasetId")
		targetPath, pathOK := stringParam(request.Params, "targetPath")
		if !idOK || !pathOK {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId and targetPath are required", false), true
		}
		result, err := datasets.ExportDatasetCSV(ctx, datasetID, targetPath)
		if err != nil {
			return failure(request.ID, "EXPORT_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "dataset.delete":
		datasetID, ok := stringParam(request.Params, "datasetId")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "datasetId is required", false), true
		}
		result, err := datasets.DeleteDataset(ctx, datasetID)
		if err != nil {
			return failure(request.ID, "DELETION_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
