package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func importQueryFixture(t *testing.T) (*Service, DatasetSummary) {
	t.Helper()
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	contents := "Region,Amount,Status\nNorth,10.5,paid\nSouth,20,paid\nNorth,30,open\nNorth,5,paid\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	result, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	return service, result.Datasets[0]
}

func text(value string) *string { return &value }

func TestExecuteQueryPlanCompilesBoundedAggregation(t *testing.T) {
	service, dataset := importQueryFixture(t)
	result, err := service.ExecuteQueryPlan(context.Background(), SafeQueryPlan{
		SchemaVersion: 1,
		DatasetID:     dataset.ID,
		VersionID:     dataset.VersionID,
		Purpose:       "Paid sales by region",
		Dimensions:    []string{"Region"},
		Measures:      []QueryMeasure{{Operation: "sum", Column: text("Amount")}},
		Filters:       []QueryFilter{{Column: "Status", Operator: "equals", Value: text("paid")}},
		Sort:          []QuerySort{{OutputIndex: 1, Direction: "descending"}},
		Limit:         20,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 2 || result.Rows[0][0] != "South" || result.Rows[0][1] != float64(20) {
		t.Fatalf("unexpected aggregate result: %#v", result)
	}
	if result.Truncated {
		t.Fatal("small aggregate result must not be truncated")
	}
}

func TestExecuteQueryPlanBindsHostileFilterValues(t *testing.T) {
	service, dataset := importQueryFixture(t)
	hostile := "paid' OR 1=1; DROP TABLE datasets; --"
	result, err := service.ExecuteQueryPlan(context.Background(), SafeQueryPlan{
		SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
		Purpose: "Hostile filter", Dimensions: []string{"Region"},
		Measures: []QueryMeasure{}, Filters: []QueryFilter{{Column: "Status", Operator: "equals", Value: &hostile}},
		Sort: []QuerySort{}, Limit: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 0 {
		t.Fatalf("hostile filter escaped its bound parameter: %#v", result.Rows)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 1 {
		t.Fatalf("catalog changed after hostile filter: %#v, %v", datasets, err)
	}
}

func TestExecuteQueryPlanRejectsStaleUnknownAndInvalidTypedPlans(t *testing.T) {
	service, dataset := importQueryFixture(t)
	base := SafeQueryPlan{
		SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
		Purpose: "Check", Dimensions: []string{"Region"}, Measures: []QueryMeasure{},
		Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 10,
	}
	stale := base
	stale.VersionID = strings.Repeat("f", 32)
	if _, err := service.ExecuteQueryPlan(context.Background(), stale); err == nil || !strings.Contains(err.Error(), "stale") {
		t.Fatalf("expected stale version rejection, got %v", err)
	}
	unknown := base
	unknown.Dimensions = []string{"Not a column"}
	if _, err := service.ExecuteQueryPlan(context.Background(), unknown); err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("expected unknown column rejection, got %v", err)
	}
	textSum := base
	textSum.Dimensions = []string{}
	textSum.Measures = []QueryMeasure{{Operation: "sum", Column: text("Region")}}
	if _, err := service.ExecuteQueryPlan(context.Background(), textSum); err == nil || !strings.Contains(err.Error(), "numeric") {
		t.Fatalf("expected non-numeric sum rejection, got %v", err)
	}
}

func TestExecuteQueryPlanEnforcesResultLimitAndReportsTruncation(t *testing.T) {
	service, dataset := importQueryFixture(t)
	result, err := service.ExecuteQueryPlan(context.Background(), SafeQueryPlan{
		SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
		Purpose: "First row", Dimensions: []string{"Region", "Amount"}, Measures: []QueryMeasure{},
		Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 1 || !result.Truncated {
		t.Fatalf("expected one truncated row, got %#v", result)
	}
}

func TestExecuteQueryPlanRejectsAnOversizedResultCell(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "large-cell.csv")
	if err := os.WriteFile(source, []byte("Value\n"+strings.Repeat("x", maximumQueryCellBytes+1)+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	dataset := imported.Datasets[0]
	_, err = service.ExecuteQueryPlan(context.Background(), SafeQueryPlan{
		SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
		Purpose: "Read value", Dimensions: []string{"Value"}, Measures: []QueryMeasure{},
		Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 10,
	})
	if err == nil || !strings.Contains(err.Error(), "larger than 10000") {
		t.Fatalf("expected oversized cell rejection, got %v", err)
	}
}
