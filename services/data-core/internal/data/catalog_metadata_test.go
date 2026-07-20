package data

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestDatasetContactNamingAndVersionHistory(t *testing.T) {
	root := t.TempDir()
	initial := filepath.Join(root, "sales.csv")
	replacement := filepath.Join(root, "sales-next.csv")
	if err := os.WriteFile(initial, []byte("Region,Amount\nNorth,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("Region,Amount\nNorth,20\nSouth,30\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	renamed, err := service.RenameDataset(context.Background(), DatasetRenameInput{
		DatasetID: datasetID, DisplayName: "华东销售日报",
	})
	if err != nil {
		t.Fatal(err)
	}
	if renamed.DisplayName != "华东销售日报" {
		t.Fatalf("unexpected display name: %#v", renamed)
	}
	if _, err := service.ReplaceFile(context.Background(), datasetID, replacement); err != nil {
		t.Fatal(err)
	}
	versions, err := service.ListDatasetVersions(context.Background(), datasetID)
	if err != nil {
		t.Fatal(err)
	}
	if len(versions) != 2 || !versions[0].Current || versions[0].Version != 2 || versions[1].Current {
		t.Fatalf("unexpected version history: %#v", versions)
	}
	if versions[0].SourceName != "sales-next.csv" || versions[1].SourceName != "sales.csv" {
		t.Fatalf("version source filenames were not preserved: %#v", versions)
	}
}
