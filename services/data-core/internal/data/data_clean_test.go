package data

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func cleanText(value string) *string { return &value }

func reviewedCleanInput(t *testing.T, displayName string, plan DataCleanPlan) DerivedDatasetCreateInput {
	t.Helper()
	transformation := DerivedTransformationPlan{Kind: "data-clean", CleanPlan: &plan}
	_, fingerprint, err := derivedPlanEvidence(transformation)
	if err != nil {
		t.Fatal(err)
	}
	policy := DataCleanQualityPolicy{SchemaVersion: 1, Rules: []DataCleanQualityRule{{ID: "output-has-rows", Severity: "blocking", Kind: "row-count", Minimum: cleanInt(1)}}}
	_, qualityFingerprint, err := dataCleanQualityPolicyEvidence(policy)
	if err != nil {
		t.Fatal(err)
	}
	return DerivedDatasetCreateInput{DisplayName: displayName, Transformation: transformation, QualityPolicy: &policy, Review: &DerivedMaterializationReview{Kind: "one-use-approval", PlanFingerprint: fingerprint, QualityPolicyFingerprint: qualityFingerprint, ReviewedAt: time.Now().UTC().Format(time.RFC3339Nano)}}
}

func cleanInt(value int) *int { return &value }

func TestDataCleanExpressionsAndLiteralFillAreDeterministic(t *testing.T) {
	table := cleanTable{
		columns: []string{"First", "Last", "Flag", "Missing"},
		rows: [][]*string{
			{cleanText("Ada"), cleanText("Lovelace"), cleanText("1"), nil},
			{cleanText("Grace"), cleanText("Hopper"), cleanText("false"), cleanText("")},
		},
	}
	operations := []DataCleanOperation{
		{Kind: "cast", Column: "Flag", To: "boolean", OnInvalid: "reject"},
		{Kind: "fill-missing", Column: "Missing", Fill: &DataCleanFill{Strategy: "literal", Value: cleanScalar("unknown")}},
		{Kind: "derive", Name: "Full", Expression: &DataCleanExpression{Kind: "concatenate", Columns: []string{"First", "Last"}, Separator: " "}},
		{Kind: "derive", Name: "Source", Expression: &DataCleanExpression{Kind: "literal", Value: cleanScalar("clean-test")}},
	}
	var err error
	for _, operation := range operations {
		table, err = applyDataCleanOperation(context.Background(), table, []cleanTable{table}, operation)
		if err != nil {
			t.Fatal(err)
		}
	}
	if *table.rows[0][2] != "true" || *table.rows[1][2] != "false" || *table.rows[0][3] != "unknown" || *table.rows[0][4] != "Ada Lovelace" || *table.rows[1][5] != "clean-test" {
		t.Fatalf("unexpected deterministic expression output: %#v", table.rows)
	}
}

func TestDataCleanCastTargetsAndInvalidPolicies(t *testing.T) {
	cases := []struct {
		name   string
		value  string
		target string
		want   string
	}{
		{name: "integer", value: " 42 ", target: "integer", want: "42"},
		{name: "real", value: "2.50", target: "real", want: "2.5"},
		{name: "datetime", value: "2026-07-26", target: "datetime", want: "2026-07-26T00:00:00Z"},
		{name: "text", value: "  keep  ", target: "text", want: "  keep  "},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			actual, err := castCleanCell(cleanText(test.value), test.target)
			if err != nil || actual == nil || *actual != test.want {
				t.Fatalf("cast %s: actual=%v err=%v", test.target, actual, err)
			}
		})
	}
	invalid := cleanTable{columns: []string{"Value"}, rows: [][]*string{{cleanText("not-a-number")}}}
	nulled, err := applyDataCleanOperation(context.Background(), invalid, []cleanTable{invalid}, DataCleanOperation{Kind: "cast", Column: "Value", To: "real", OnInvalid: "null"})
	if err != nil || nulled.rows[0][0] != nil {
		t.Fatalf("null invalid policy failed: %#v err=%v", nulled, err)
	}
	if _, err := applyDataCleanOperation(context.Background(), invalid, []cleanTable{invalid}, DataCleanOperation{Kind: "cast", Column: "Value", To: "real", OnInvalid: "reject"}); err == nil {
		t.Fatal("reject invalid policy accepted a non-number")
	}
}

func TestDataCleanNullPredicatesAndDivideByZeroPolicies(t *testing.T) {
	nullPredicate := DataCleanPredicate{Column: "Value", Operator: "is-null"}
	keep, err := evaluateCleanPredicate(nil, nullPredicate)
	if err != nil || !keep {
		t.Fatalf("null predicate failed: keep=%v err=%v", keep, err)
	}
	columns := []string{"Left", "Right"}
	row := []*string{cleanText("10"), cleanText("0")}
	nulled, err := evaluateCleanExpression(columns, row, DataCleanExpression{Kind: "arithmetic", Operator: "divide", LeftColumn: "Left", RightColumn: "Right", OnInvalid: "reject", DivideByZero: "null"})
	if err != nil || nulled != nil {
		t.Fatalf("null divide policy failed: value=%v err=%v", nulled, err)
	}
	_, err = evaluateCleanExpression(columns, row, DataCleanExpression{Kind: "arithmetic", Operator: "divide", LeftColumn: "Left", RightColumn: "Right", OnInvalid: "reject", DivideByZero: "reject"})
	if err == nil || !strings.Contains(err.Error(), "division by zero") {
		t.Fatalf("reject divide policy failed: %v", err)
	}
}

func TestDataCleanNumericBoundariesRejectNonFiniteValues(t *testing.T) {
	equalToNumber := DataCleanPredicate{Column: "Value", Operator: "equals", Value: cleanScalar(42)}
	for _, value := range []string{"NaN", "+Inf", "-Inf"} {
		matched, err := evaluateCleanPredicate(cleanText(value), equalToNumber)
		if err != nil || matched {
			t.Fatalf("non-finite value %q compared equal to a finite operand: matched=%v err=%v", value, matched, err)
		}
	}
	rows := [][]any{{"NaN"}, {"+Inf"}, {"2.5"}}
	if sum, invalid := cleanNumericSumRows(rows, 0); sum != 2.5 || invalid != 2 {
		t.Fatalf("non-finite aggregate values were accepted: sum=%v invalid=%d", sum, invalid)
	}
}

func TestDataCleanRejectsIncompatibleAppendAndHonorsCancellation(t *testing.T) {
	current := cleanTable{columns: []string{"A"}, rows: [][]*string{{cleanText("1")}}}
	incompatible := cleanTable{columns: []string{"B"}, rows: [][]*string{{cleanText("2")}}}
	if _, err := applyDataCleanOperation(context.Background(), current, []cleanTable{current, incompatible}, DataCleanOperation{Kind: "append", SourceIndex: 1}); err == nil || !strings.Contains(err.Error(), "identical ordered schema") {
		t.Fatalf("incompatible append was accepted: %v", err)
	}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := applyDataCleanOperation(cancelled, current, []cleanTable{current}, DataCleanOperation{Kind: "select", Columns: []string{"A"}}); err == nil {
		t.Fatal("cancelled clean operation continued")
	}
}

func TestDataCleanPlanAndLineageSurviveBackupRestore(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{
		SchemaVersion: 1, Purpose: "Backup clean plan",
		Sources:    []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}},
		Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region", "Amount"}}},
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Backup clean", plan))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "clean.bubu-backup")
	if _, err := service.CreateBackup(context.Background(), path); err != nil {
		t.Fatal(err)
	}
	if _, err := service.DeleteDataset(context.Background(), created.Dataset.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.RestoreBackup(context.Background(), path); err != nil {
		t.Fatal(err)
	}
	lineage, err := service.GetDerivedDatasetLineage(context.Background(), created.Dataset.ID)
	if err != nil || lineage == nil || lineage.TransformationKind != "data-clean" || lineage.PlanFingerprint != created.Lineage.PlanFingerprint || lineage.ExecutionEvidence.ExecutionID != created.Lineage.ExecutionEvidence.ExecutionID || lineage.ExecutionEvidence.CleanImpact == nil {
		t.Fatalf("restored clean lineage is incomplete: %#v err=%v", lineage, err)
	}
	recomputed, err := service.RecomputeDerivedDataset(context.Background(), created.Dataset.ID)
	if err != nil {
		t.Fatalf("restored clean plan cannot recompute: %v", err)
	}
	if recomputed.Lineage.ExecutionEvidence.ReviewKind != "reviewed-recompute" || recomputed.Lineage.ExecutionEvidence.ExecutionID == created.Lineage.ExecutionEvidence.ExecutionID || recomputed.Lineage.ExecutionEvidence.CleanImpact == nil {
		t.Fatalf("recomputed clean evidence is incomplete: %#v", recomputed.Lineage.ExecutionEvidence)
	}
}

func TestPreviewDataCleanPlanIsReadOnlyAndMatchesMaterializationEvidence(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{SchemaVersion: 1, Purpose: "Preview clean", Sources: []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}}, Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region", "Amount"}}, {Kind: "deduplicate", Keys: []string{"Region"}, Keep: "first"}}}
	before, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	policy := DataCleanQualityPolicy{SchemaVersion: 1, Rules: []DataCleanQualityRule{{ID: "output-has-rows", Severity: "blocking", Kind: "row-count", Minimum: cleanInt(1)}}}
	preview, err := service.PreviewDataCleanPlan(context.Background(), plan, policy)
	if err != nil {
		t.Fatal(err)
	}
	after, err := service.ListDatasets(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(after) != len(before) {
		t.Fatalf("preview wrote a dataset: before=%d after=%d", len(before), len(after))
	}
	if preview.Impact.PlanFingerprint == "" || preview.Impact.ResultRowCount != 2 || len(preview.Impact.ResultColumns) != 2 || len(preview.Impact.Operations) != 2 || preview.Impact.Operations[1].BeforeRowCount != 4 || preview.Impact.Operations[1].AfterRowCount != 2 || preview.Quality.Status != "passed" {
		t.Fatalf("preview impact is incomplete: %#v", preview)
	}
	created, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Preview clean", plan))
	if err != nil {
		t.Fatal(err)
	}
	if created.Lineage.PlanFingerprint != preview.Impact.PlanFingerprint || created.Dataset.RowCount != int64(preview.Impact.ResultRowCount) || created.Lineage.ExecutionEvidence.ReviewKind != "one-use-approval" || created.Lineage.ExecutionEvidence.QualityGateStatus != "passed" || created.Lineage.ExecutionEvidence.Quality == nil || created.Lineage.ExecutionEvidence.CleanImpact == nil || len(created.Lineage.ExecutionEvidence.CleanImpact.Operations) != 2 {
		t.Fatalf("preview and materialization drifted: preview=%#v created=%#v", preview, created)
	}
}

func TestDataCleanMaterializationRejectsMissingTamperedAndExpiredReview(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{SchemaVersion: 1, Purpose: "Review boundary", Sources: []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}}, Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region"}}}}
	input := reviewedCleanInput(t, "Reviewed clean", plan)
	missing := input
	missing.Review = nil
	if _, err := service.MaterializeDerivedDataset(context.Background(), missing); err == nil || !strings.Contains(err.Error(), "one-use reviewed evidence") {
		t.Fatalf("missing review was accepted: %v", err)
	}
	tampered := input
	tampered.Review = &DerivedMaterializationReview{Kind: "one-use-approval", PlanFingerprint: strings.Repeat("f", 64), QualityPolicyFingerprint: input.Review.QualityPolicyFingerprint, ReviewedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	if _, err := service.MaterializeDerivedDataset(context.Background(), tampered); err == nil || !strings.Contains(err.Error(), "fingerprint") {
		t.Fatalf("tampered review was accepted: %v", err)
	}
	expired := input
	expired.Review = &DerivedMaterializationReview{Kind: "one-use-approval", PlanFingerprint: input.Review.PlanFingerprint, QualityPolicyFingerprint: input.Review.QualityPolicyFingerprint, ReviewedAt: time.Now().UTC().Add(-11 * time.Minute).Format(time.RFC3339Nano)}
	if _, err := service.MaterializeDerivedDataset(context.Background(), expired); err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("expired review was accepted: %v", err)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 1 {
		t.Fatalf("rejected reviews left partial data: %#v err=%v", datasets, err)
	}
}

func TestDataCleanQualityGateBlocksActivationAndPersistsWarnings(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{SchemaVersion: 1, Purpose: "Quality gate", Sources: []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}}, Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region", "Status"}}}}
	blocked := reviewedCleanInput(t, "Blocked clean", plan)
	blocked.QualityPolicy = &DataCleanQualityPolicy{SchemaVersion: 1, Rules: []DataCleanQualityRule{{ID: "impossible-count", Severity: "blocking", Kind: "row-count", Minimum: cleanInt(99)}}}
	_, blockedFingerprint, err := dataCleanQualityPolicyEvidence(*blocked.QualityPolicy)
	if err != nil {
		t.Fatal(err)
	}
	blocked.Review.QualityPolicyFingerprint = blockedFingerprint
	if _, err := service.MaterializeDerivedDataset(context.Background(), blocked); err == nil || !strings.Contains(err.Error(), "quality gate blocked") {
		t.Fatalf("blocking rule activated output: %v", err)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 1 {
		t.Fatalf("blocked gate left a partial dataset: %#v err=%v", datasets, err)
	}
	var blockedAttempts int
	if err := service.database.QueryRow("SELECT COUNT(*) FROM data_clean_quality_attempts WHERE status = 'blocked'").Scan(&blockedAttempts); err != nil || blockedAttempts != 1 {
		t.Fatalf("blocked proof was not retained: count=%d err=%v", blockedAttempts, err)
	}

	warning := reviewedCleanInput(t, "Warning clean", plan)
	warning.QualityPolicy = &DataCleanQualityPolicy{SchemaVersion: 1, Rules: []DataCleanQualityRule{{ID: "known-status", Severity: "warning", Kind: "accepted-values", Column: "Status", Values: []string{"closed"}}}}
	_, warningFingerprint, err := dataCleanQualityPolicyEvidence(*warning.QualityPolicy)
	if err != nil {
		t.Fatal(err)
	}
	warning.Review.QualityPolicyFingerprint = warningFingerprint
	created, err := service.MaterializeDerivedDataset(context.Background(), warning)
	if err != nil {
		t.Fatal(err)
	}
	if created.Lineage.ExecutionEvidence.QualityGateStatus != "warning" || created.Lineage.ExecutionEvidence.Quality == nil || len(created.Lineage.ExecutionEvidence.Warnings) != 1 {
		t.Fatalf("warning proof is incomplete: %#v", created.Lineage.ExecutionEvidence)
	}
}

func TestBackupValidationRejectsTamperedCleanExecutionEvidence(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{SchemaVersion: 1, Purpose: "Backup evidence", Sources: []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}}, Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region"}}}}
	created, err := service.MaterializeDerivedDataset(context.Background(), reviewedCleanInput(t, "Evidence", plan))
	if err != nil {
		t.Fatal(err)
	}
	forged := `{"planFingerprint":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","sources":[{"datasetId":"` + source.ID + `","versionId":"` + source.VersionID + `","displayName":"sales","rowCount":4,"columns":["Region"]}],"resultRowCount":4,"resultColumns":["Region"],"operations":[{"ordinal":1,"kind":"select","beforeRowCount":4,"afterRowCount":4,"beforeColumnCount":3,"afterColumnCount":1,"beforeColumns":["Region","Amount","Status"],"afterColumns":["Region"],"affectedRowCount":4}]}`
	if _, err := service.database.Exec("UPDATE derived_dataset_lineages SET clean_impact_json = ? WHERE version_id = ?", forged, created.Dataset.VersionID); err != nil {
		t.Fatal(err)
	}
	if err := validateBackupDerivedExecutionEvidence(context.Background(), service.database, len(migrations)); err == nil || !strings.Contains(err.Error(), "invalid data-clean impact") {
		t.Fatalf("tampered impact evidence was accepted: %v", err)
	}
}
