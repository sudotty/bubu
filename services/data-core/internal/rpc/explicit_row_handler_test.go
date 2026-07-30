package rpc

import (
	"context"
	"strings"
	"testing"
)

func TestExplicitRowDisclosurePreviewDispatchesOnlyStrictSelection(t *testing.T) {
	fake := &fakeDatasets{}
	request := Request{ProtocolVersion: ProtocolVersion, Auth: testToken, ID: "rows", Method: "dataset.rows.disclosure.preview", Params: map[string]any{
		"schemaVersion": float64(1), "datasetId": strings.Repeat("a", 32), "versionId": strings.Repeat("b", 32), "purpose": "review", "rowNumbers": []any{float64(1)}, "columns": []any{"Order ID"},
	}}
	response := HandleWithData(context.Background(), request, testToken, fake)
	if !response.OK || fake.explicitRowSelection.Purpose != "review" || len(fake.explicitRowSelection.RowNumbers) != 1 {
		t.Fatalf("explicit disclosure preview was not dispatched: %#v %#v", response, fake.explicitRowSelection)
	}
	request.Params["unexpected"] = true
	if rejected := HandleWithData(context.Background(), request, testToken, fake); rejected.OK || rejected.Error == nil || rejected.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown disclosure field was accepted: %#v", rejected)
	}
}
