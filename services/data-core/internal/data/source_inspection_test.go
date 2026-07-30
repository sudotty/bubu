package data

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestInspectSourceReturnsNormalizedSchemaWithoutCreatingDataset(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "incoming.csv")
	if err := os.WriteFile(path, []byte(" Order ,Amount\nA,10\nB,20\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	inspection, err := service.InspectSource(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	if inspection.SourceKind != "csv" || len(inspection.Tables) != 1 || inspection.Tables[0].RowCount != 2 || inspection.Tables[0].Columns[0] != "Order" {
		t.Fatalf("unexpected inspection: %#v", inspection)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 0 {
		t.Fatalf("inspection mutated catalog: %#v err=%v", datasets, err)
	}
}
