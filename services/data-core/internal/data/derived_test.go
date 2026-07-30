package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMaterializeDatasetQueryCreatesTraceableDerivedObject(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := SafeQueryPlan{
		SchemaVersion: 1,
		DatasetID:     source.ID,
		VersionID:     source.VersionID,
		Purpose:       "Paid sales by region",
		Dimensions:    []string{"Region"},
		Measures:      []QueryMeasure{{Operation: "sum", Column: text("Amount")}},
		Filters:       []QueryFilter{{Column: "Status", Operator: "equals", Value: text("paid")}},
		Sort:          []QuerySort{},
		Limit:         20,
	}

	created, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName: "Paid sales summary",
		Transformation: DerivedTransformationPlan{
			Kind:        "dataset-query",
			DatasetPlan: &plan,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Dataset.SourceKind != "derived" || created.Dataset.RowCount != 2 {
		t.Fatalf("unexpected derived dataset: %#v", created.Dataset)
	}
	if len(created.Lineage.Parents) != 1 || created.Lineage.Parents[0].VersionID != source.VersionID {
		t.Fatalf("lineage did not retain the immutable parent: %#v", created.Lineage)
	}
	preview, err := service.Preview(context.Background(), created.Dataset.ID, 50, 0)
	if err != nil || len(preview.Rows) != 2 {
		t.Fatalf("derived rows are unavailable: %#v, %v", preview, err)
	}
}

func TestDerivedObjectBackupRestoresLineageWithoutPersistedSourceLocator(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := SafeQueryPlan{
		SchemaVersion: 1, DatasetID: source.ID, VersionID: source.VersionID,
		Purpose: "Paid sales backup", Dimensions: []string{"Region"},
		Measures: []QueryMeasure{{Operation: "sum", Column: text("Amount")}},
		Filters:  []QueryFilter{}, Sort: []QuerySort{}, Limit: 20,
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName:    "Backup-safe summary",
		Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &plan},
	})
	if err != nil {
		t.Fatal(err)
	}
	backupPath := filepath.Join(t.TempDir(), "derived.bubu-backup")
	backup, err := service.CreateBackup(context.Background(), backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if backup.DatasetCount != 2 {
		t.Fatalf("derived object was not counted in backup: %#v", backup)
	}
	if _, err := service.DeleteDataset(context.Background(), created.Dataset.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.RestoreBackup(context.Background(), backupPath); err != nil {
		t.Fatal(err)
	}
	lineage, err := service.GetDerivedDatasetLineage(context.Background(), created.Dataset.ID)
	if err != nil || lineage == nil || lineage.PlanFingerprint != created.Lineage.PlanFingerprint {
		t.Fatalf("restored derived lineage is incomplete: %#v err=%v", lineage, err)
	}
}

func TestRecomputeDerivedDatasetCreatesNewVersionFromCurrentParent(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := SafeQueryPlan{
		SchemaVersion: 1, DatasetID: source.ID, VersionID: source.VersionID,
		Purpose: "Sales rows", Dimensions: []string{"Region", "Amount"}, Measures: []QueryMeasure{},
		Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 20,
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName:    "Sales snapshot",
		Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &plan},
	})
	if err != nil {
		t.Fatal(err)
	}
	replacement := filepath.Join(t.TempDir(), "sales.csv")
	if err := os.WriteFile(replacement, []byte("Region,Amount,Status\nNorth,100,paid\nSouth,50,paid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	replaced, err := service.ReplaceFile(context.Background(), source.ID, replacement)
	if err != nil || replaced.Dataset == nil {
		t.Fatalf("replace parent version: %#v, %v", replaced, err)
	}
	recomputed, err := service.RecomputeDerivedDataset(context.Background(), created.Dataset.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recomputed.Dataset.Version != 2 || recomputed.Dataset.VersionID == created.Dataset.VersionID {
		t.Fatalf("recompute did not create an immutable next version: %#v", recomputed.Dataset)
	}
	if recomputed.Lineage.Parents[0].VersionID != replaced.Dataset.VersionID {
		t.Fatalf("recompute did not bind the current parent version: %#v", recomputed.Lineage)
	}
}

func TestMaterializeGroupQueryKeepsEveryParentVersion(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	plan := baseGroupQueryPlan(group)
	created, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName:    "Orders with categories",
		Transformation: DerivedTransformationPlan{Kind: "group-query", GroupPlan: &plan},
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Dataset.RowCount != 4 || len(created.Lineage.Parents) != 2 {
		t.Fatalf("group materialization lost rows or parents: %#v", created)
	}
	for index, parent := range created.Lineage.Parents {
		if parent.DatasetID != group.Members[index].ID || parent.VersionID != group.Members[index].VersionID {
			t.Fatalf("group lineage parent %d is wrong: %#v", index, parent)
		}
	}
}

func TestDerivedObjectCanMaterializeAnotherDerivedObject(t *testing.T) {
	service, source := importQueryFixture(t)
	firstPlan := SafeQueryPlan{
		SchemaVersion: 1, DatasetID: source.ID, VersionID: source.VersionID,
		Purpose: "Regional sales layer", Dimensions: []string{"Region"},
		Measures: []QueryMeasure{{Operation: "sum", Column: text("Amount")}},
		Filters:  []QueryFilter{}, Sort: []QuerySort{}, Limit: 20,
	}
	first, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName:    "Regional sales X",
		Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &firstPlan},
	})
	if err != nil {
		t.Fatal(err)
	}
	preview, err := service.Preview(context.Background(), first.Dataset.ID, 20, 0)
	if err != nil || len(preview.Columns) != 2 {
		t.Fatalf("preview first derived object: %#v err=%v", preview, err)
	}
	secondPlan := SafeQueryPlan{
		SchemaVersion: 1, DatasetID: first.Dataset.ID, VersionID: first.Dataset.VersionID,
		Purpose: "Chained regional sales", Dimensions: []string{preview.Columns[0].Name},
		Measures: []QueryMeasure{{Operation: "sum", Column: text(preview.Columns[1].Name)}},
		Filters:  []QueryFilter{}, Sort: []QuerySort{}, Limit: 20,
	}
	second, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{
		DisplayName:    "Regional sales Y",
		Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &secondPlan},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Lineage.Parents) != 1 || second.Lineage.Parents[0].DatasetID != first.Dataset.ID || second.Lineage.Parents[0].VersionID != first.Dataset.VersionID {
		t.Fatalf("Y did not retain X as its immutable parent: %#v", second.Lineage)
	}
	secondPreview, err := service.Preview(context.Background(), second.Dataset.ID, 20, 0)
	if err != nil || len(secondPreview.Rows) != len(preview.Rows) {
		t.Fatalf("chained derived rows are unavailable: %#v err=%v", secondPreview, err)
	}
}

func cleanScalar(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return raw
}

func importAdditionalCleanSource(t *testing.T, service *Service, name, contents string) DatasetSummary {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := service.ImportFile(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	return result.Datasets[0]
}

func TestDataCleanPlanExecutesEveryOperationClassAndKeepsAllParents(t *testing.T) {
	service, primary := importQueryFixture(t)
	appended := importAdditionalCleanSource(t, service, "next.csv", "Region,Amount,Status\n north , ,paid\nEast,40,paid\n")
	unioned := importAdditionalCleanSource(t, service, "mapped.csv", "Zone,Revenue,State\nWest,50,paid\n")
	plan := DataCleanPlan{
		SchemaVersion: 1,
		Purpose:       "Normalize recurring orders",
		Sources: []DataCleanSource{
			{DatasetID: primary.ID, VersionID: primary.VersionID},
			{DatasetID: appended.ID, VersionID: appended.VersionID},
			{DatasetID: unioned.ID, VersionID: unioned.VersionID},
		},
		Operations: []DataCleanOperation{
			{Kind: "append", SourceIndex: 1},
			{Kind: "union", SourceIndex: 2, Mapping: []DataCleanColumnMapping{{Source: "Zone", Target: "Region"}, {Source: "Revenue", Target: "Amount"}, {Source: "State", Target: "Status"}}},
			{Kind: "replace", Column: "Region", Match: cleanScalar("north"), Replacement: cleanScalar("North"), Mode: "normalized-text"},
			{Kind: "cast", Column: "Amount", To: "real", OnInvalid: "null"},
			{Kind: "fill-missing", Column: "Amount", Fill: &DataCleanFill{Strategy: "mean"}},
			{Kind: "derive", Name: "Double", Expression: &DataCleanExpression{Kind: "arithmetic", Operator: "multiply", LeftColumn: "Amount", RightColumn: "Amount", OnInvalid: "reject", DivideByZero: "reject"}},
			{Kind: "filter", Predicate: &DataCleanPredicate{Column: "Status", Operator: "equals", Value: cleanScalar("paid")}},
			{Kind: "deduplicate", Keys: []string{"Region"}, Keep: "last"},
			{Kind: "select", Columns: []string{"Region", "Amount", "Double"}},
			{Kind: "rename", Column: "Region", Name: "Area"},
		},
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Clean orders", plan))
	if err != nil {
		t.Fatal(err)
	}
	if created.Dataset.RowCount != 4 || created.Dataset.ColumnCount != 3 || created.Lineage.TransformationKind != "data-clean" || len(created.Lineage.Parents) != 3 {
		t.Fatalf("clean materialization lost output or lineage: %#v", created)
	}
	preview, err := service.Preview(context.Background(), created.Dataset.ID, 20, 0)
	if err != nil {
		t.Fatal(err)
	}
	if preview.Columns[0].Name != "Area" || len(preview.Rows) != 4 {
		t.Fatalf("unexpected clean output: %#v", preview)
	}
	for _, row := range preview.Rows {
		if row[0] == "North" && (row[1] == nil || strings.TrimSpace(row[1].(string)) == "") {
			t.Fatalf("mean fill did not repair the retained North row: %#v", row)
		}
	}
}

func TestDataCleanRejectsInvalidCastWithoutCreatingPartialDataset(t *testing.T) {
	service, source := importQueryFixture(t)
	before, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	plan := DataCleanPlan{
		SchemaVersion: 1, Purpose: "Reject invalid cast",
		Sources:    []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}},
		Operations: []DataCleanOperation{{Kind: "cast", Column: "Region", To: "integer", OnInvalid: "reject"}},
	}
	if _, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Must not exist", plan)); err == nil || !strings.Contains(err.Error(), "not an integer") {
		t.Fatalf("expected deterministic cast rejection, got %v", err)
	}
	after, err := service.ListDatasets(context.Background())
	if err != nil || len(after) != len(before) {
		t.Fatalf("failed clean execution left a partial dataset: before=%d after=%d err=%v", len(before), len(after), err)
	}
}

func TestDataCleanRecomputeRebindsCurrentSourceVersion(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{
		SchemaVersion: 1, Purpose: "Reusable cleanup",
		Sources:    []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}},
		Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region", "Amount"}}},
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Reusable clean", plan))
	if err != nil {
		t.Fatal(err)
	}
	replacementPath := filepath.Join(t.TempDir(), "replacement.csv")
	if err := os.WriteFile(replacementPath, []byte("Region,Amount,Status\nNorth,99,paid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	replaced, err := service.ReplaceFile(context.Background(), source.ID, replacementPath)
	if err != nil || replaced.Dataset == nil {
		t.Fatalf("replace clean source: %#v err=%v", replaced, err)
	}
	recomputed, err := service.RecomputeDerivedDataset(context.Background(), created.Dataset.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recomputed.Dataset.Version != 2 || recomputed.Lineage.Parents[0].VersionID != replaced.Dataset.VersionID {
		t.Fatalf("clean recompute did not bind the current source: %#v", recomputed)
	}
}
