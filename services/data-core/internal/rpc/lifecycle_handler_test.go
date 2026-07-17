package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) ExportDatasetCSV(
	_ context.Context,
	datasetID string,
	targetPath string,
) (data.DatasetExportResult, error) {
	fake.exportedID = datasetID
	fake.exportedPath = targetPath
	return data.DatasetExportResult{Status: "exported", DatasetID: datasetID}, nil
}

func (fake *fakeDatasets) DeleteDataset(
	_ context.Context,
	datasetID string,
) (data.DatasetDeletionResult, error) {
	fake.deletedID = datasetID
	return data.DatasetDeletionResult{Status: "deleted", DatasetID: datasetID}, nil
}

func TestDatasetExportDelegatesOnlyPrivatePaths(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "export-1",
		Method:          "dataset.export",
		Params: map[string]any{
			"datasetId":  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"targetPath": "/tmp/safe.csv",
		},
	}, testToken, fake)
	if !response.OK || fake.exportedID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" || fake.exportedPath != "/tmp/safe.csv" {
		t.Fatalf("unexpected export response: %#v id=%q path=%q", response, fake.exportedID, fake.exportedPath)
	}
}

func TestDatasetDeletionRequiresAnIdentifier(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "delete-1",
		Method:          "dataset.delete",
		Params:          map[string]any{},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" || fake.deletedID != "" {
		t.Fatalf("unexpected deletion response: %#v id=%q", response, fake.deletedID)
	}
}
