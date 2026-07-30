package rpc

import (
	"context"
	"strings"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) PreviewDataCleanPlan(
	_ context.Context,
	plan data.DataCleanPlan,
	policy data.DataCleanQualityPolicy,
) (data.DataCleanReviewPreview, error) {
	fake.derivedInput.Transformation = data.DerivedTransformationPlan{Kind: "data-clean", CleanPlan: &plan}
	return data.DataCleanReviewPreview{
		Impact: data.DataCleanImpactPreview{
			PlanFingerprint: strings.Repeat("a", 64), ResultRowCount: 2, ResultColumns: []string{"id"},
			Sources:    []data.DataCleanImpactSource{{DatasetID: plan.Sources[0].DatasetID, VersionID: plan.Sources[0].VersionID, DisplayName: "source", RowCount: 3, Columns: []string{"id"}}},
			Operations: []data.DataCleanOperationImpact{{Ordinal: 1, Kind: plan.Operations[0].Kind, BeforeRowCount: 3, AfterRowCount: 2, BeforeColumnCount: 1, AfterColumnCount: 1, BeforeColumns: []string{"id"}, AfterColumns: []string{"id"}, AffectedRowCount: 1}},
		},
		Quality: data.DataCleanQualityEvidence{PolicyFingerprint: strings.Repeat("b", 64), Status: "passed", Results: []data.DataCleanQualityResult{{RuleID: policy.Rules[0].ID, Severity: "blocking", Kind: "row-count", Passed: true, Observed: "2 rows", Expected: "at least 1", SampleRowNumbers: []int{}}}},
	}, nil
}

func (fake *fakeDatasets) MaterializeDerivedDataset(
	_ context.Context,
	input data.DerivedDatasetCreateInput,
) (data.DerivedDatasetMaterializationResult, error) {
	fake.derivedInput = input
	return data.DerivedDatasetMaterializationResult{Dataset: data.DatasetSummary{DisplayName: input.DisplayName, SourceKind: "derived"}}, nil
}

func (fake *fakeDatasets) RecomputeDerivedDataset(
	_ context.Context,
	datasetID string,
) (data.DerivedDatasetMaterializationResult, error) {
	fake.recomputedID = datasetID
	return data.DerivedDatasetMaterializationResult{}, nil
}

func (fake *fakeDatasets) GetDerivedDatasetLineage(
	_ context.Context,
	datasetID string,
) (*data.DerivedDatasetLineage, error) {
	fake.lineageID = datasetID
	return nil, nil
}

func (fake *fakeDatasets) GetDerivedDependencyPlan(context.Context, string) (data.DerivedDependencyPlan, error) {
	return data.DerivedDependencyPlan{}, nil
}
func (fake *fakeDatasets) ProcessDerivedRecomputeEvents(context.Context) ([]data.DerivedRecomputeEvent, error) {
	return []data.DerivedRecomputeEvent{}, nil
}
func (fake *fakeDatasets) ListDerivedRecomputeEvents(context.Context, string) ([]data.DerivedRecomputeEvent, error) {
	return []data.DerivedRecomputeEvent{}, nil
}
func (fake *fakeDatasets) RetryDerivedRecomputeEvent(context.Context, string) (data.DerivedRecomputeEvent, error) {
	return data.DerivedRecomputeEvent{}, nil
}
func (fake *fakeDatasets) CancelDerivedRecomputeEvent(context.Context, string) (data.DerivedRecomputeEvent, error) {
	return data.DerivedRecomputeEvent{}, nil
}

func TestHandleDerivedDatasetKeepsAPlanOnlyBoundary(t *testing.T) {
	fake := &fakeDatasets{}
	id := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	request := Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "derived-1",
		Method:          "dataset.derived.materialize",
		Params: map[string]any{"input": map[string]any{
			"displayName": "Regional summary",
			"transformation": map[string]any{
				"kind": "dataset-query",
				"plan": map[string]any{
					"schemaVersion": 1, "datasetId": id, "versionId": id,
					"purpose": "Summary", "dimensions": []any{"Region"}, "measures": []any{},
					"filters": []any{}, "sort": []any{}, "limit": 50,
				},
			},
		}},
	}
	response := HandleWithData(context.Background(), request, testToken, fake)
	if !response.OK || fake.derivedInput.Transformation.DatasetPlan == nil {
		t.Fatalf("typed derived input was not dispatched: %#v, %#v", response, fake.derivedInput)
	}
	request.Params["input"].(map[string]any)["sql"] = "DROP TABLE datasets"
	response = HandleWithData(context.Background(), request, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown SQL field crossed the derived boundary: %#v", response)
	}
}

func TestHandleDerivedRecomputeAndLineageUseDatasetIdentity(t *testing.T) {
	fake := &fakeDatasets{}
	id := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	for _, method := range []string{"dataset.derived.recompute", "dataset.derived.lineage"} {
		response := HandleWithData(context.Background(), Request{
			ProtocolVersion: ProtocolVersion, Auth: testToken, ID: method,
			Method: method, Params: map[string]any{"datasetId": id},
		}, testToken, fake)
		if !response.OK {
			t.Fatalf("%s failed: %#v", method, response)
		}
	}
	if fake.recomputedID != id || fake.lineageID != id {
		t.Fatalf("derived identity was not preserved: recompute=%q lineage=%q", fake.recomputedID, fake.lineageID)
	}
}

func TestHandleDerivedDatasetParsesStrictDataCleanPlan(t *testing.T) {
	fake := &fakeDatasets{}
	id := "cccccccccccccccccccccccccccccccc"
	operation := map[string]any{"kind": "select", "columns": []any{"Region", "Amount"}}
	request := Request{
		ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "clean-1", Method: "dataset.derived.materialize",
		Params: map[string]any{"input": map[string]any{
			"displayName": "Clean sales",
			"transformation": map[string]any{
				"kind": "data-clean",
				"cleanPlan": map[string]any{
					"schemaVersion": 1, "purpose": "Normalize sales",
					"sources":    []any{map[string]any{"datasetId": id, "versionId": id}},
					"operations": []any{operation},
				},
			},
		}},
	}
	response := HandleWithData(context.Background(), request, testToken, fake)
	if !response.OK || fake.derivedInput.Transformation.CleanPlan == nil || len(fake.derivedInput.Transformation.CleanPlan.Operations) != 1 {
		t.Fatalf("typed data-clean input was not dispatched: %#v input=%#v", response, fake.derivedInput)
	}
	operation["sql"] = "DROP TABLE datasets"
	response = HandleWithData(context.Background(), request, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown operation field crossed the data-clean boundary: %#v", response)
	}
}

func TestHandleDataCleanPreviewUsesTheReadOnlyPlanBoundary(t *testing.T) {
	fake := &fakeDatasets{}
	id := "cccccccccccccccccccccccccccccccc"
	response := HandleWithData(context.Background(), Request{ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "clean-preview", Method: "dataset.clean.preview", Params: map[string]any{"plan": map[string]any{"schemaVersion": 1, "purpose": "Preview", "sources": []any{map[string]any{"datasetId": id, "versionId": id}}, "operations": []any{map[string]any{"kind": "select", "columns": []any{"Region"}}}}, "qualityPolicy": map[string]any{"schemaVersion": 1, "rules": []any{map[string]any{"id": "output-has-rows", "severity": "blocking", "kind": "row-count", "minimum": 1}}}}}, testToken, fake)
	if !response.OK || fake.derivedInput.Transformation.CleanPlan == nil {
		t.Fatalf("data-clean preview was not dispatched: %#v", response)
	}
}
