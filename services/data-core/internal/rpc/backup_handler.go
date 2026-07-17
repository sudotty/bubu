package rpc

import "context"

func handleDataProtection(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	switch request.Method {
	case "data.backup.create":
		targetPath, ok := stringParam(request.Params, "targetPath")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "targetPath is required", false), true
		}
		result, err := datasets.CreateBackup(ctx, targetPath)
		if err != nil {
			return failure(request.ID, "BACKUP_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "data.backup.restore":
		sourcePath, ok := stringParam(request.Params, "sourcePath")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "sourcePath is required", false), true
		}
		result, err := datasets.RestoreBackup(ctx, sourcePath)
		if err != nil {
			return failure(request.ID, "RESTORE_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
