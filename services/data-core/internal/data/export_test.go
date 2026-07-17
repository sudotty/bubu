package data

import (
	"context"
	"encoding/csv"
	"os"
	"path/filepath"
	"testing"
)

func TestExportDatasetCSVStreamsAnExcelSafeCurrentVersion(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "formulas.csv")
	output := filepath.Join(root, "safe-export.csv")
	contents := "Name,Formula,Amount\nAlice,=2+2,10\nBob,+SUM(A1:A2),-5\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.ExportDatasetCSV(context.Background(), imported.Datasets[0].ID, output)
	if err != nil {
		t.Fatal(err)
	}
	if result.FileName != "safe-export.csv" || result.RowCount != 2 || result.Mode != "excel-safe" {
		t.Fatalf("unexpected export result: %#v", result)
	}
	file, err := os.Open(output)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	records, err := csv.NewReader(file).ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	if records[1][1] != "'=2+2" || records[2][1] != "'+SUM(A1:A2)" {
		t.Fatalf("text formulas were not neutralized: %#v", records)
	}
	if records[2][2] != "-5" {
		t.Fatalf("numeric negative value was changed: %#v", records[2])
	}
	info, err := os.Stat(output)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("export permissions are %o, want 600", info.Mode().Perm())
	}
	raw, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) < 3 || raw[0] != 0xef || raw[1] != 0xbb || raw[2] != 0xbf {
		t.Fatal("export is missing its Excel-compatible UTF-8 marker")
	}
}

func TestExportDatasetCSVRejectsNonCSVTargets(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "source.csv")
	if err := os.WriteFile(source, []byte("Name\nAlice\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.ExportDatasetCSV(context.Background(), imported.Datasets[0].ID, filepath.Join(root, "export.xlsx")); err == nil {
		t.Fatal("non-CSV export target was accepted")
	}
}
