package data

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestOpenUpgradesAVersionOneCatalog(t *testing.T) {
	dataDirectory := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dataDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", filepath.Join(dataDirectory, "bubu.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(migrations[0].sql); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec("INSERT INTO schema_migrations(version) VALUES (1)"); err != nil {
		t.Fatal(err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, dataDirectory)
	var applied int
	if err := service.database.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = 2").Scan(&applied); err != nil {
		t.Fatal(err)
	}
	if applied != 1 {
		t.Fatal("version 2 migration was not applied")
	}
}

func TestImportCSVListAndPreview(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	contents := "Order ID,Region,Amount,Region\n001,North,10.5,N\n002,South,20,S\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	result, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Datasets) != 1 {
		t.Fatalf("got %d datasets, want 1", len(result.Datasets))
	}
	dataset := result.Datasets[0]
	if dataset.RowCount != 2 || dataset.ColumnCount != 4 || dataset.SourceName != "sales.csv" {
		t.Fatalf("unexpected dataset: %#v", dataset)
	}

	list, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != dataset.ID {
		t.Fatalf("unexpected list result: %#v", list)
	}

	preview, err := service.Preview(context.Background(), dataset.ID, 50, 0)
	if err != nil {
		t.Fatal(err)
	}
	wantColumns := []string{"Order ID", "Region", "Amount", "Region (2)"}
	if len(preview.Columns) != len(wantColumns) || len(preview.Rows) != 2 {
		t.Fatalf("unexpected preview shape: %#v", preview)
	}
	for index, want := range wantColumns {
		if preview.Columns[index].Name != want {
			t.Fatalf("column %d: got %q, want %q", index, preview.Columns[index].Name, want)
		}
	}
	if preview.Columns[0].InferredType != ColumnTypeText {
		t.Fatalf("leading-zero identifier must remain text: %#v", preview.Columns[0])
	}
	if preview.Columns[2].InferredType != ColumnTypeReal {
		t.Fatalf("amount must infer as real: %#v", preview.Columns[2])
	}
	if got := preview.Rows[0][0]; got != "001" {
		t.Fatalf("raw identifier changed: %#v", got)
	}

	databaseBytes, err := os.ReadFile(filepath.Join(root, "data", "bubu.db"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(databaseBytes), source) {
		t.Fatal("database persisted the absolute source path")
	}
}

func TestImportCSVFailureRollsBackCatalogAndData(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "broken.csv")
	if err := os.WriteFile(source, []byte("A,B\n1,2,3\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	if _, err := service.ImportFile(context.Background(), source); err == nil {
		t.Fatal("expected malformed row to fail")
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(datasets) != 0 {
		t.Fatalf("failed import left catalog rows: %#v", datasets)
	}
}

func TestImportFilesRollsBackTheWholeSelection(t *testing.T) {
	root := t.TempDir()
	valid := filepath.Join(root, "valid.csv")
	broken := filepath.Join(root, "broken.csv")
	if err := os.WriteFile(valid, []byte("A,B\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(broken, []byte("A,B\n1,2,3\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	if _, err := service.ImportFiles(context.Background(), []string{valid, broken}); err == nil {
		t.Fatal("expected the selection to fail")
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(datasets) != 0 {
		t.Fatalf("failed selection left partially imported datasets: %#v", datasets)
	}
}

func TestImportTSVDetectsDelimiterFromBoundedSample(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "inventory.tsv")
	contents := "SKU\tStock\n001\t8\n002\t13\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	result, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Datasets) != 1 || result.Datasets[0].ColumnCount != 2 {
		t.Fatalf("unexpected TSV import: %#v", result)
	}
	preview, err := service.Preview(context.Background(), result.Datasets[0].ID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := preview.Rows[1][1]; got != "13" {
		t.Fatalf("unexpected TSV preview value: %#v", got)
	}
}

func TestImportWorkbookCreatesOneDatasetPerNonEmptySheet(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "operations.xlsx")
	book := excelize.NewFile()
	defaultSheet := book.GetSheetName(0)
	if err := book.SetSheetName(defaultSheet, "Sales"); err != nil {
		t.Fatal(err)
	}
	if err := book.SetSheetRow("Sales", "A1", &[]any{"Order", "Amount"}); err != nil {
		t.Fatal(err)
	}
	if err := book.SetSheetRow("Sales", "A2", &[]any{"A-1", 12.5}); err != nil {
		t.Fatal(err)
	}
	book.NewSheet("Targets")
	if err := book.SetSheetRow("Targets", "A1", &[]any{"Region", "Target"}); err != nil {
		t.Fatal(err)
	}
	if err := book.SetSheetRow("Targets", "A2", &[]any{"North", 20}); err != nil {
		t.Fatal(err)
	}
	book.NewSheet("Empty")
	if err := book.SaveAs(source); err != nil {
		t.Fatal(err)
	}
	if err := book.Close(); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	result, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Datasets) != 2 {
		t.Fatalf("got %d datasets, want 2: %#v", len(result.Datasets), result)
	}
	if result.Datasets[0].DisplayName != "operations · Sales" {
		t.Fatalf("unexpected first sheet name: %#v", result.Datasets[0])
	}
	if result.Datasets[1].DisplayName != "operations · Targets" {
		t.Fatalf("unexpected second sheet name: %#v", result.Datasets[1])
	}
}

func TestReplaceFileCreatesAnImmutableVersionForTheSameDataset(t *testing.T) {
	root := t.TempDir()
	initial := filepath.Join(root, "sales-week-1.csv")
	replacement := filepath.Join(root, "sales-week-2.csv")
	if err := os.WriteFile(initial, []byte("Order,Amount\nA-1,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("Order,Amount\nA-2,25\nA-3,30\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	replaced, err := service.ReplaceFile(context.Background(), datasetID, replacement)
	if err != nil {
		t.Fatal(err)
	}
	if replaced.Status != ReplacementApplied || replaced.Dataset == nil {
		t.Fatalf("unexpected replacement result: %#v", replaced)
	}
	if replaced.Dataset.ID != datasetID || replaced.Dataset.Version != 2 || replaced.Dataset.RowCount != 2 {
		t.Fatalf("replacement did not preserve identity and advance version: %#v", replaced.Dataset)
	}
	preview, err := service.Preview(context.Background(), datasetID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := preview.Rows[0][0]; got != "A-2" {
		t.Fatalf("preview did not switch to the replacement version: %#v", got)
	}
}

func TestReplaceFileReportsSchemaDriftWithoutChangingTheCurrentVersion(t *testing.T) {
	root := t.TempDir()
	initial := filepath.Join(root, "sales.csv")
	replacement := filepath.Join(root, "drifted.csv")
	if err := os.WriteFile(initial, []byte("Order,Amount\nA-1,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("Order,Total\nA-2,25\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	result, err := service.ReplaceFile(context.Background(), datasetID, replacement)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != ReplacementMappingRequired || result.Drift == nil {
		t.Fatalf("expected mapping-required drift: %#v", result)
	}
	if strings.Join(result.Drift.MissingColumns, ",") != "Amount" || strings.Join(result.Drift.AddedColumns, ",") != "Total" {
		t.Fatalf("unexpected drift: %#v", result.Drift)
	}
	preview, err := service.Preview(context.Background(), datasetID, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := preview.Rows[0][0]; got != "A-1" {
		t.Fatalf("drifted replacement changed the current version: %#v", got)
	}
}

func openTestService(t *testing.T, dataDirectory string) *Service {
	t.Helper()
	service, err := Open(dataDirectory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := service.Close(); err != nil {
			t.Errorf("close service: %v", err)
		}
	})
	return service
}
