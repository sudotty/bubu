package rpc

import (
	"context"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type modelAuditService interface {
	StartModelAudit(context.Context, data.ModelAuditStartInput) (data.ModelAuditEvent, error)
	FinishModelAudit(context.Context, data.ModelAuditFinishInput) (data.ModelAuditEvent, error)
	ListModelAudits(context.Context) ([]data.ModelAuditEvent, error)
}

func handleModelAudit(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	audits, ok := datasets.(modelAuditService)
	if !ok {
		return Response{}, false
	}
	switch request.Method {
	case "privacy.disclosure.start":
		input, ok := objectParam[data.ModelAuditStartInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a bounded model disclosure", false), true
		}
		result, err := audits.StartModelAudit(ctx, input)
		if err != nil {
			return failure(request.ID, "DISCLOSURE_AUDIT_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "privacy.disclosure.finish":
		input, ok := objectParam[data.ModelAuditFinishInput](request.Params, "input")
		if !ok {
			return failure(request.ID, "INVALID_ARGUMENT", "input must be a terminal model disclosure", false), true
		}
		result, err := audits.FinishModelAudit(ctx, input)
		if err != nil {
			return failure(request.ID, "DISCLOSURE_AUDIT_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	case "privacy.disclosure.list":
		result, err := audits.ListModelAudits(ctx)
		if err != nil {
			return failure(request.ID, "DISCLOSURE_AUDIT_FAILED", err.Error(), false), true
		}
		return success(request.ID, result), true
	default:
		return Response{}, false
	}
}
