package rpc

func handleHealth(request Request, datasets DatasetService) Response {
	capabilities := []string{"local-rpc"}
	if datasets != nil {
		capabilities = []string{
			"cancellable-requests",
			"deterministic-workflows",
			"workflow-idempotency",
			"workflow-checkpoints",
			"persistent-workflow-triggers",
			"model-disclosure-ledger",
			"model-usage-accounting",
			"sqlite",
			"csv-import",
			"xlsx-import",
			"dataset-catalog",
			"excel-safe-csv-export",
			"permanent-dataset-deletion",
			"verified-local-backup",
			"transactional-backup-restore",
			"preview",
			"version-replacement",
			"schema-drift",
			"local-quality-report",
			"local-column-distributions",
			"validation-rules",
			"privacy-context",
			"safe-query-plan",
			"dataset-groups",
			"reusable-relationships",
			"local-conversations",
		}
	}
	return success(request.ID, ServiceHealth{
		Service:         "data-core",
		ProtocolVersion: ProtocolVersion,
		Status:          "ready",
		Capabilities:    capabilities,
	})
}
