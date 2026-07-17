package data

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestCompareSchemasDistinguishesRenameAndReorder(t *testing.T) {
	renamed := CompareSchemas([]string{"Order", "Amount"}, []string{"Order", "Total"})
	if len(renamed.MissingColumns) != 1 || renamed.MissingColumns[0] != "Amount" {
		t.Fatalf("unexpected missing columns: %#v", renamed)
	}
	if len(renamed.AddedColumns) != 1 || renamed.AddedColumns[0] != "Total" || renamed.Reordered {
		t.Fatalf("unexpected added columns: %#v", renamed)
	}

	reordered := CompareSchemas([]string{"Order", "Amount"}, []string{"Amount", "Order"})
	if !reordered.Reordered || len(reordered.MissingColumns) != 0 || len(reordered.AddedColumns) != 0 {
		t.Fatalf("unexpected reorder result: %#v", reordered)
	}
}

func TestMappedReplacementPreservesLogicalSchemaAndCreatesANewVersion(t *testing.T) {
	root := t.TempDir()
	initial := filepath.Join(root, "sales-week-1.csv")
	replacement := filepath.Join(root, "sales-week-2.csv")
	if err := os.WriteFile(initial, []byte("Order,Amount\nA-1,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("Total,Order Number,Ignored\n25,A-2,x\n30,A-3,y\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	result, err := service.ReplaceFileWithMapping(
		context.Background(),
		datasetID,
		replacement,
		[]ColumnMapping{
			{CurrentColumn: "Order", IncomingColumn: "Order Number"},
			{CurrentColumn: "Amount", IncomingColumn: "Total"},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != ReplacementApplied || result.Dataset == nil || result.Dataset.Version != 2 {
		t.Fatalf("unexpected mapped replacement: %#v", result)
	}
	preview, err := service.Preview(context.Background(), datasetID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Columns) != 2 || preview.Columns[0].Name != "Order" || preview.Columns[1].Name != "Amount" {
		t.Fatalf("logical schema changed: %#v", preview.Columns)
	}
	if preview.Rows[0][0] != "A-2" || preview.Rows[0][1] != "25" {
		t.Fatalf("mapped values are incorrect: %#v", preview.Rows)
	}
}

func TestMappedReplacementRejectsDuplicateOrIncompleteMappings(t *testing.T) {
	root := t.TempDir()
	initial := filepath.Join(root, "sales.csv")
	replacement := filepath.Join(root, "drifted.csv")
	if err := os.WriteFile(initial, []byte("Order,Amount\nA-1,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("Order Number,Total\nA-2,25\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}

	_, err = service.ReplaceFileWithMapping(
		context.Background(),
		imported.Datasets[0].ID,
		replacement,
		[]ColumnMapping{
			{CurrentColumn: "Order", IncomingColumn: "Order Number"},
			{CurrentColumn: "Amount", IncomingColumn: "Order Number"},
		},
	)
	if err == nil {
		t.Fatal("duplicate incoming mapping was accepted")
	}
	_, err = service.ReplaceFileWithMapping(
		context.Background(),
		imported.Datasets[0].ID,
		replacement,
		[]ColumnMapping{{CurrentColumn: "Order", IncomingColumn: "Order Number"}},
	)
	if err == nil {
		t.Fatal("incomplete mapping was accepted")
	}
}
