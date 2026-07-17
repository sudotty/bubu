package rpc

import (
	"context"
	"errors"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type fakeDatasets struct {
	importedPath  string
	importedPaths []string
	replacedID    string
	replacedPath  string
}

func (fake *fakeDatasets) ReplaceFile(
	_ context.Context,
	datasetID string,
	sourcePath string,
) (data.ReplacementResult, error) {
	fake.replacedID = datasetID
	fake.replacedPath = sourcePath
	return data.ReplacementResult{Status: data.ReplacementMappingRequired, Drift: &data.SchemaDrift{}}, nil
}

func (fake *fakeDatasets) ModelContext(
	_ context.Context,
	datasetID string,
	disclosure data.DisclosureLevel,
) (data.ModelContextResult, error) {
	return data.ModelContextResult{DatasetID: datasetID, Disclosure: disclosure}, nil
}

func (fake *fakeDatasets) ImportFiles(_ context.Context, sourcePaths []string) (data.ImportResult, error) {
	fake.importedPaths = sourcePaths
	return data.ImportResult{Datasets: []data.DatasetSummary{{ID: "one"}}}, nil
}

func (fake *fakeDatasets) ImportFile(_ context.Context, sourcePath string) (data.ImportResult, error) {
	fake.importedPath = sourcePath
	return data.ImportResult{Datasets: []data.DatasetSummary{{ID: "one"}}}, nil
}

func (fake *fakeDatasets) ListDatasets(context.Context) ([]data.DatasetSummary, error) {
	return []data.DatasetSummary{{ID: "one"}}, nil
}

func (fake *fakeDatasets) Preview(context.Context, string, int, int) (data.PreviewResult, error) {
	return data.PreviewResult{}, errors.New("not found")
}

func TestDatasetImportRequiresAPath(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "import-1",
		Method:          "dataset.import",
		Params:          map[string]any{},
	}, testToken, fake)

	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unexpected response: %#v", response)
	}
}

func TestDatasetImportDelegatesOnlyAfterAuthentication(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "import-1",
		Method:          "dataset.import",
		Params:          map[string]any{"sourcePath": "/tmp/sales.csv"},
	}, testToken, fake)

	if !response.OK || fake.importedPath != "/tmp/sales.csv" {
		t.Fatalf("unexpected import response: %#v, path=%q", response, fake.importedPath)
	}
}

func TestDatasetBatchImportDelegatesOneBoundedSelection(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "import-many-1",
		Method:          "dataset.import.batch",
		Params:          map[string]any{"sourcePaths": []any{"/tmp/sales.csv", "/tmp/targets.xlsx"}},
	}, testToken, fake)

	if !response.OK || len(fake.importedPaths) != 2 || fake.importedPaths[1] != "/tmp/targets.xlsx" {
		t.Fatalf("unexpected batch import response: %#v, paths=%#v", response, fake.importedPaths)
	}
}

func TestDatasetBatchImportRejectsAnEmptySelection(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "import-many-1",
		Method:          "dataset.import.batch",
		Params:          map[string]any{"sourcePaths": []any{}},
	}, testToken, fake)

	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unexpected response: %#v", response)
	}
}

func TestDatasetReplacementDelegatesDatasetAndPrivatePath(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "replace-1",
		Method:          "dataset.replace",
		Params: map[string]any{
			"datasetId":  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"sourcePath": "/tmp/sales-week-2.csv",
		},
	}, testToken, fake)

	if !response.OK || fake.replacedID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" || fake.replacedPath != "/tmp/sales-week-2.csv" {
		t.Fatalf("unexpected replacement response: %#v, id=%q path=%q", response, fake.replacedID, fake.replacedPath)
	}
}

func TestDatasetContextDelegatesAnExplicitDisclosureLevel(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "context-1",
		Method:          "dataset.context",
		Params: map[string]any{
			"datasetId":  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"disclosure": "schema-synthetic",
		},
	}, testToken, fake)

	if !response.OK {
		t.Fatalf("unexpected context response: %#v", response)
	}
}
