package rpc

import "context"

func handleExtendedMethods(
	ctx context.Context,
	request Request,
	datasets DatasetService,
) (Response, bool) {
	for _, handler := range []func(context.Context, Request, DatasetService) (Response, bool){
		handleModelAudit,
		handleWorkflow,
		handleDatasetLifecycle,
		handleDataProtection,
		handleDistribution,
		handleDerivedDataset,
		handleReconciliation,
		handleLocalKnowledge,
	} {
		if response, handled := handler(ctx, request, datasets); handled {
			return response, true
		}
	}
	return Response{}, false
}
