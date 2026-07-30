package rpc

import (
	"context"
	"strings"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) PreviewReconciliation(_ context.Context, plan data.ReconciliationPlan) (data.ReconciliationPreview, error) {
	fake.reconciliationPlan = plan
	return data.ReconciliationPreview{PlanFingerprint: strings.Repeat("a", 64)}, nil
}
func (fake *fakeDatasets) ExecuteReconciliation(_ context.Context, plan data.ReconciliationPlan, review data.ReconciliationReview) (data.ReconciliationArtifact, error) {
	fake.reconciliationPlan, fake.reconciliationReview = plan, review
	return data.ReconciliationArtifact{SchemaVersion: 1, ID: strings.Repeat("e", 32)}, nil
}
func (fake *fakeDatasets) GetReconciliationArtifact(_ context.Context, id string) (data.ReconciliationArtifact, error) {
	return data.ReconciliationArtifact{SchemaVersion: 1, ID: id}, nil
}
func (fake *fakeDatasets) SaveReconciliationDefinition(_ context.Context, artifactID string) (data.ReconciliationDefinition, error) {
	return data.ReconciliationDefinition{SchemaVersion: 1, ID: strings.Repeat("d", 32), LastArtifactID: artifactID}, nil
}
func (fake *fakeDatasets) ListReconciliationArtifacts(context.Context, []string) ([]data.ReconciliationArtifact, error) {
	return []data.ReconciliationArtifact{}, nil
}
func (fake *fakeDatasets) ProcessReconciliationReplayEvents(context.Context) ([]data.ReconciliationReplayEvent, error) {
	return []data.ReconciliationReplayEvent{}, nil
}
func (fake *fakeDatasets) ListReconciliationReplayEvents(context.Context, []string) ([]data.ReconciliationReplayEvent, error) {
	return []data.ReconciliationReplayEvent{}, nil
}
func (fake *fakeDatasets) RetryReconciliationReplayEvent(_ context.Context, id string) (data.ReconciliationReplayEvent, error) {
	return data.ReconciliationReplayEvent{SchemaVersion: 1, ID: id, Status: "pending"}, nil
}
func (fake *fakeDatasets) CancelReconciliationReplayEvent(_ context.Context, id string) (data.ReconciliationReplayEvent, error) {
	return data.ReconciliationReplayEvent{SchemaVersion: 1, ID: id, Status: "cancelled"}, nil
}

func reconciliationRPCPlan() map[string]any {
	return map[string]any{"schemaVersion": float64(1), "purpose": "订单付款对账", "comparison": map[string]any{"schemaVersion": float64(1), "purpose": "订单付款比较", "sources": map[string]any{"left": map[string]any{"datasetId": strings.Repeat("a", 32), "versionId": strings.Repeat("b", 32)}, "right": map[string]any{"datasetId": strings.Repeat("c", 32), "versionId": strings.Repeat("d", 32)}}, "match": map[string]any{"keys": []any{map[string]any{"leftColumn": "Order ID", "rightColumn": "Payment Order", "normalization": []any{"trim"}}}, "cardinality": "one-to-one"}, "budgets": map[string]any{"maximumCandidatePairs": float64(100), "timeoutMs": float64(1000)}}, "controlTotals": []any{map[string]any{"id": "gross", "leftColumn": "Amount", "rightColumn": "Paid", "aggregation": "sum", "tolerance": 0.01}}, "unresolvedPolicy": "review-required"}
}

func TestReconciliationRPCRejectsUnknownFieldsAndDispatchesReviewedExecution(t *testing.T) {
	fake := &fakeDatasets{}
	plan := reconciliationRPCPlan()
	preview := HandleWithData(context.Background(), Request{ProtocolVersion: 1, Auth: testToken, ID: "preview", Method: "reconciliation.preview", Params: map[string]any{"plan": plan}}, testToken, fake)
	if !preview.OK || fake.reconciliationPlan.Purpose != "订单付款对账" {
		t.Fatalf("preview was not dispatched: %#v", preview)
	}
	plan["sql"] = "select * from private"
	rejected := HandleWithData(context.Background(), Request{ProtocolVersion: 1, Auth: testToken, ID: "reject", Method: "reconciliation.preview", Params: map[string]any{"plan": plan}}, testToken, fake)
	if rejected.OK || rejected.Error == nil || rejected.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown SQL crossed boundary: %#v", rejected)
	}
	delete(plan, "sql")
	review := map[string]any{"kind": "one-use-approval", "planFingerprint": strings.Repeat("e", 64), "reviewedAt": "2026-07-27T00:00:00Z"}
	executed := HandleWithData(context.Background(), Request{ProtocolVersion: 1, Auth: testToken, ID: "execute", Method: "reconciliation.execute", Params: map[string]any{"plan": plan, "review": review}}, testToken, fake)
	if !executed.OK || fake.reconciliationReview.Kind != "one-use-approval" {
		t.Fatalf("reviewed execution was not dispatched: %#v", executed)
	}
}

func TestReconciliationRPCExposesBoundedDurableReplayLifecycle(t *testing.T) {
	fake := &fakeDatasets{}
	datasetIDs := []any{strings.Repeat("a", 32), strings.Repeat("c", 32)}
	requests := []Request{
		{ProtocolVersion: 1, Auth: testToken, ID: "save", Method: "reconciliation.definition.save", Params: map[string]any{"artifactId": strings.Repeat("e", 32)}},
		{ProtocolVersion: 1, Auth: testToken, ID: "artifacts", Method: "reconciliation.artifacts.list", Params: map[string]any{"datasetIds": datasetIDs}},
		{ProtocolVersion: 1, Auth: testToken, ID: "process", Method: "reconciliation.replay.process", Params: map[string]any{}},
		{ProtocolVersion: 1, Auth: testToken, ID: "events", Method: "reconciliation.replay.events", Params: map[string]any{"datasetIds": datasetIDs}},
		{ProtocolVersion: 1, Auth: testToken, ID: "retry", Method: "reconciliation.replay.retry", Params: map[string]any{"id": strings.Repeat("f", 32)}},
		{ProtocolVersion: 1, Auth: testToken, ID: "cancel", Method: "reconciliation.replay.cancel", Params: map[string]any{"id": strings.Repeat("f", 32)}},
	}
	for _, request := range requests {
		if response := HandleWithData(context.Background(), request, testToken, fake); !response.OK {
			t.Fatalf("%s was not dispatched: %#v", request.Method, response)
		}
	}
	tooMany := make([]any, 9)
	for index := range tooMany {
		tooMany[index] = strings.Repeat("a", 32)
	}
	rejected := HandleWithData(context.Background(), Request{ProtocolVersion: 1, Auth: testToken, ID: "unbounded", Method: "reconciliation.replay.events", Params: map[string]any{"datasetIds": tooMany}}, testToken, fake)
	if rejected.OK || rejected.Error == nil || rejected.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unbounded replay filter crossed boundary: %#v", rejected)
	}
}
