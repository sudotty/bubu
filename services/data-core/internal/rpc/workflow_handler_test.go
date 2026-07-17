package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type fakeWorkflowDatasets struct {
	*fakeDatasets
	saved data.WorkflowDefinitionInput
}

func (fake *fakeWorkflowDatasets) SaveWorkflow(_ context.Context, input data.WorkflowDefinitionInput) (data.WorkflowDefinition, error) {
	fake.saved = input
	return data.WorkflowDefinition{
		ID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Name: input.Name, Target: input.Target,
		Trigger: input.Trigger, TimeoutMS: input.TimeoutMS, Steps: input.Steps,
		Version: 1, CreatedAt: "2026-07-17T00:00:00Z", UpdatedAt: "2026-07-17T00:00:00Z",
	}, nil
}

func (fake *fakeWorkflowDatasets) ListWorkflows(context.Context, *data.WorkflowTarget) ([]data.WorkflowDefinition, error) {
	return []data.WorkflowDefinition{}, nil
}

func (fake *fakeWorkflowDatasets) DeleteWorkflow(context.Context, string) error { return nil }

func (fake *fakeWorkflowDatasets) RunWorkflow(context.Context, string, string) (data.WorkflowRun, error) {
	return data.WorkflowRun{}, nil
}

func (fake *fakeWorkflowDatasets) ListWorkflowRuns(context.Context, string) ([]data.WorkflowRun, error) {
	return []data.WorkflowRun{}, nil
}

func TestHandleWorkflowSaveRequiresStrictBoundedInput(t *testing.T) {
	datasetID := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	versionID := "cccccccccccccccccccccccccccccccc"
	params := map[string]any{"input": map[string]any{
		"name":      "Regional totals",
		"target":    map[string]any{"kind": "dataset", "id": datasetID},
		"trigger":   map[string]any{"kind": "manual"},
		"timeoutMs": float64(60_000),
		"steps": []any{map[string]any{
			"id": "query", "kind": "dataset-query", "maxAttempts": float64(1),
			"plan": map[string]any{
				"schemaVersion": float64(1), "datasetId": datasetID, "versionId": versionID,
				"purpose": "Totals", "dimensions": []any{"Region"}, "measures": []any{},
				"filters": []any{}, "sort": []any{}, "limit": float64(20),
			},
		}},
	}}
	fake := &fakeWorkflowDatasets{fakeDatasets: &fakeDatasets{}}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "workflow-save",
		Method: "workflow.save", Params: params,
	}, testToken, fake)
	if !response.OK || fake.saved.Name != "Regional totals" {
		t.Fatalf("strict workflow was not saved: %#v, %#v", response, fake.saved)
	}
	params["input"].(map[string]any)["arbitraryCommand"] = "shell"
	response = HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "workflow-save-invalid",
		Method: "workflow.save", Params: params,
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown workflow authority was accepted: %#v", response)
	}
}
