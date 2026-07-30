package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) DatasetStructure(context.Context, string) (data.DatasetStructure, error) {
	return data.DatasetStructure{DatasetID: "one", VersionID: "version", Columns: []data.DatasetStructureColumn{{Ordinal: 0, Name: "Amount", InferredType: data.ColumnTypeReal}}}, nil
}

func TestDatasetStructureReturnsMetadataWithoutPreviewRows(t *testing.T) {
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "structure-1",
		Method:          "dataset.structure",
		Params:          map[string]any{"datasetId": "one"},
	}, testToken, &fakeDatasets{})
	if !response.OK {
		t.Fatalf("unexpected structure response: %#v", response)
	}
	structure, ok := response.Result.(data.DatasetStructure)
	if !ok || structure.DatasetID != "one" || len(structure.Columns) != 1 {
		t.Fatalf("unexpected structure result: %#v", response.Result)
	}
}
