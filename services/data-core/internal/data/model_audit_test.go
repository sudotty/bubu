package data

import (
	"context"
	"testing"
)

func datasetModelAuditInput(dataset DatasetSummary) ModelAuditStartInput {
	return ModelAuditStartInput{
		Purpose: "query-plan", Target: ModelAuditTarget{Kind: "dataset", ID: dataset.ID},
		Disclosure: "schema-synthetic", ProviderID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ProviderKind: "openai", ProviderName: "Audited provider", Model: "model-example",
		EndpointOrigin: "https://api.example.com", DatasetCount: 1, ColumnCount: dataset.ColumnCount,
		SyntheticRowCount: 3, RelationshipCount: 0, PayloadBytes: 2_048,
		EstimatedInputTokens: 683, MaximumOutputTokens: 4_096,
		PayloadSHA256:   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		ContainsRawRows: false,
	}
}

func TestModelAuditPersistsDisclosureAndUsageWithoutPayload(t *testing.T) {
	service, dataset := importQueryFixture(t)
	event, err := service.StartModelAudit(context.Background(), datasetModelAuditInput(dataset))
	if err != nil {
		t.Fatal(err)
	}
	if event.Status != "started" || event.FinishedAt != nil || event.ContainsRawRows {
		t.Fatalf("unexpected initial model audit: %#v", event)
	}
	inputTokens, outputTokens, totalTokens := 100, 20, 120
	finished, err := service.FinishModelAudit(context.Background(), ModelAuditFinishInput{
		ID: event.ID, Status: "succeeded", InputTokens: &inputTokens,
		OutputTokens: &outputTokens, TotalTokens: &totalTokens, OutputBytes: 80,
	})
	if err != nil {
		t.Fatal(err)
	}
	if finished.Status != "succeeded" || finished.TotalTokens == nil || *finished.TotalTokens != 120 {
		t.Fatalf("model usage was not persisted: %#v", finished)
	}
	failure := "must not overwrite the terminal outcome"
	if _, err := service.FinishModelAudit(context.Background(), ModelAuditFinishInput{
		ID: event.ID, Status: "failed", OutputBytes: 0, Error: &failure,
	}); err == nil {
		t.Fatal("model audit terminal outcome was overwritten")
	}
	listed, err := service.ListModelAudits(context.Background())
	if err != nil || len(listed) != 1 || listed[0].PayloadSHA256 == "" {
		t.Fatalf("model audit was not listed: %#v, %v", listed, err)
	}
}

func TestModelAuditFailsClosedAndRecoversInterruptedRequests(t *testing.T) {
	service, dataset := importQueryFixture(t)
	invalid := datasetModelAuditInput(dataset)
	invalid.ContainsRawRows = true
	if _, err := service.StartModelAudit(context.Background(), invalid); err == nil {
		t.Fatal("raw-row model disclosure was accepted")
	}
	event, err := service.StartModelAudit(context.Background(), datasetModelAuditInput(dataset))
	if err != nil {
		t.Fatal(err)
	}
	if err := recoverInterruptedModelAudits(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	recovered, err := service.getModelAudit(context.Background(), event.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Status != "failed" || recovered.Error == nil || recovered.FinishedAt == nil {
		t.Fatalf("interrupted model audit was not closed: %#v", recovered)
	}
}
