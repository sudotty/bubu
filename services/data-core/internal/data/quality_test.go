package data

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestQualityReportPersistsAndRunsLocalValidationRules(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	contents := "Order,Region,Amount,Note\nA-1,North,10,x\nA-1,South,200,\nA-3,,30,x\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	minimum := 0.0
	maximum := 100.0
	rules := []ValidationRule{
		{Kind: "required", Column: "Region"},
		{Kind: "unique", Column: "Order"},
		{Kind: "number-range", Column: "Amount", Minimum: &minimum, Maximum: &maximum},
		{Kind: "pattern", Column: "Order", Pattern: `^A-[0-9]+$`},
		{Kind: "allowed-values", Column: "Region", Values: []string{"North"}},
	}
	report, err := service.SaveValidationRules(context.Background(), datasetID, rules)
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Rules) != 5 || len(report.Validation) != 5 || report.Score >= 100 {
		t.Fatalf("unexpected validation report: %#v", report)
	}
	wantFailures := []int64{1, 2, 1, 0, 1}
	for index, want := range wantFailures {
		if report.Validation[index].FailedRows != want {
			t.Fatalf("rule %d failed rows: got %d, want %d", index, report.Validation[index].FailedRows, want)
		}
	}
	if report.Validation[0].SampleRowNumbers[0] != 3 || report.Validation[2].SampleRowNumbers[0] != 2 {
		t.Fatalf("unexpected failure samples: %#v", report.Validation)
	}
	if report.Columns[2].MinValue == nil || *report.Columns[2].MinValue != "10" || report.Columns[2].MaxValue == nil || *report.Columns[2].MaxValue != "200" {
		t.Fatalf("numeric profile used lexical bounds: %#v", report.Columns[2])
	}

	reloaded, err := service.GetQualityReport(context.Background(), datasetID)
	if err != nil {
		t.Fatal(err)
	}
	if len(reloaded.Rules) != 5 || reloaded.Validation[1].FailedRows != 2 {
		t.Fatalf("validation rules were not durable: %#v", reloaded)
	}
}

func TestValidationRejectsUnknownAndTypeIncompatibleColumns(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	if err := os.WriteFile(source, []byte("Order,Amount\nA-1,ten\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	minimum := 0.0
	if _, err := service.SaveValidationRules(context.Background(), imported.Datasets[0].ID, []ValidationRule{
		{Kind: "required", Column: "Missing"},
	}); err == nil {
		t.Fatal("unknown validation column was accepted")
	}
	if _, err := service.SaveValidationRules(context.Background(), imported.Datasets[0].ID, []ValidationRule{
		{Kind: "number-range", Column: "Amount", Minimum: &minimum},
	}); err == nil {
		t.Fatal("numeric validation was accepted for a text column")
	}
}
