package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPreviewExplicitRowDisclosureIsExactBoundedAndReadOnly(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "refunds.csv")
	if err := os.WriteFile(source, []byte("Order ID,Refund Amount,Note\nA-1,5,first\nA-2,10.25,second\nA-3,,third\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	dataset := imported.Datasets[0]
	selection := ExplicitRowDisclosureSelection{
		SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
		Purpose: "解释退款异常", RowNumbers: []int64{2, 3}, Columns: []string{"Order ID", "Refund Amount"},
	}
	preview, err := service.PreviewExplicitRowDisclosure(context.Background(), selection)
	if err != nil {
		t.Fatal(err)
	}
	if preview.CellCount != 4 || len(preview.Rows) != 2 || preview.Rows[0].RowNumber != 2 || preview.Rows[0].Cells[0] != "A-2" || preview.Rows[1].Cells[1] != nil {
		t.Fatalf("unexpected disclosure preview: %#v", preview)
	}
	if preview.PayloadBytes < 1 || len(preview.PayloadSHA256) != 64 {
		t.Fatalf("missing bounded payload evidence: %#v", preview)
	}
	var auditCount int
	if err := service.database.QueryRow("SELECT COUNT(*) FROM model_disclosure_events").Scan(&auditCount); err != nil || auditCount != 0 {
		t.Fatalf("read-only preview persisted an audit before approval: %d %v", auditCount, err)
	}
}

func TestPreviewExplicitRowDisclosureRejectsExpansionAndStaleVersions(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "rows.csv")
	if err := os.WriteFile(source, []byte("A,B\n1,x\n2,y\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	dataset := imported.Datasets[0]
	base := ExplicitRowDisclosureSelection{SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID, Purpose: "review", RowNumbers: []int64{1}, Columns: []string{"A"}}
	cases := map[string]ExplicitRowDisclosureSelection{
		"duplicate row":    {SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID, Purpose: "review", RowNumbers: []int64{1, 1}, Columns: []string{"A"}},
		"duplicate column": {SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID, Purpose: "review", RowNumbers: []int64{1}, Columns: []string{"A", "A"}},
		"unknown row":      {SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID, Purpose: "review", RowNumbers: []int64{99}, Columns: []string{"A"}},
		"unknown column":   {SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID, Purpose: "review", RowNumbers: []int64{1}, Columns: []string{"*"}},
		"stale version":    {SchemaVersion: 1, DatasetID: dataset.ID, VersionID: strings.Repeat("f", 32), Purpose: "review", RowNumbers: []int64{1}, Columns: []string{"A"}},
	}
	for name, selection := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := service.PreviewExplicitRowDisclosure(context.Background(), selection); err == nil {
				t.Fatal("invalid disclosure selection was accepted")
			}
		})
	}
	if _, err := service.PreviewExplicitRowDisclosure(context.Background(), base); err != nil {
		t.Fatalf("valid disclosure was rejected: %v", err)
	}
}
