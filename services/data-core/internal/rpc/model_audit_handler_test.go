package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type fakeModelAuditDatasets struct {
	*fakeDatasets
	started data.ModelAuditStartInput
}

func (fake *fakeModelAuditDatasets) StartModelAudit(_ context.Context, input data.ModelAuditStartInput) (data.ModelAuditEvent, error) {
	fake.started = input
	return data.ModelAuditEvent{ModelAuditStartInput: input, ID: "cccccccccccccccccccccccccccccccc", Status: "started", StartedAt: "2026-07-17T00:00:00Z"}, nil
}

func (fake *fakeModelAuditDatasets) FinishModelAudit(context.Context, data.ModelAuditFinishInput) (data.ModelAuditEvent, error) {
	return data.ModelAuditEvent{}, nil
}

func (fake *fakeModelAuditDatasets) ListModelAudits(context.Context) ([]data.ModelAuditEvent, error) {
	return []data.ModelAuditEvent{}, nil
}

func TestHandleModelAuditRequiresStrictDataFreeInput(t *testing.T) {
	input := map[string]any{
		"purpose": "query-plan", "target": map[string]any{"kind": "dataset", "id": "dddddddddddddddddddddddddddddddd"},
		"disclosure": "schema-synthetic", "providerId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"providerKind": "openai", "providerName": "Provider", "model": "model",
		"endpointOrigin": "https://api.example.com", "datasetCount": float64(1),
		"columnCount": float64(3), "syntheticRowCount": float64(3), "relationshipCount": float64(0),
		"payloadBytes": float64(100), "estimatedInputTokens": float64(34), "maxOutputTokens": float64(100),
		"payloadSha256":   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"containsRawRows": false,
	}
	fake := &fakeModelAuditDatasets{fakeDatasets: &fakeDatasets{}}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "audit-start",
		Method: "privacy.disclosure.start", Params: map[string]any{"input": input},
	}, testToken, fake)
	if !response.OK || fake.started.ColumnCount != 3 {
		t.Fatalf("strict model audit was not accepted: %#v", response)
	}
	input["prompt"] = "must never enter the ledger"
	response = HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "audit-start-invalid",
		Method: "privacy.disclosure.start", Params: map[string]any{"input": input},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("raw model payload field was accepted: %#v", response)
	}
}
