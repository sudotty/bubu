package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func materializeDerivedChain(t *testing.T, service *Service, source DatasetSummary) (DerivedDatasetMaterializationResult, DerivedDatasetMaterializationResult) {
	t.Helper()
	firstPlan := SafeQueryPlan{SchemaVersion: 1, DatasetID: source.ID, VersionID: source.VersionID, Purpose: "First recurring layer", Dimensions: []string{"Region"}, Measures: []QueryMeasure{{Operation: "sum", Column: text("Amount")}}, Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 20}
	first, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{DisplayName: "Recurring regional sales", Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &firstPlan}})
	if err != nil {
		t.Fatal(err)
	}
	preview, err := service.Preview(context.Background(), first.Dataset.ID, 20, 0)
	if err != nil {
		t.Fatal(err)
	}
	secondPlan := SafeQueryPlan{SchemaVersion: 1, DatasetID: first.Dataset.ID, VersionID: first.Dataset.VersionID, Purpose: "Second recurring layer", Dimensions: []string{preview.Columns[0].Name}, Measures: []QueryMeasure{{Operation: "sum", Column: text(preview.Columns[1].Name)}}, Filters: []QueryFilter{}, Sort: []QuerySort{}, Limit: 20}
	second, err := service.MaterializeDerivedDataset(context.Background(), DerivedDatasetCreateInput{DisplayName: "Recurring sales rollup", Transformation: DerivedTransformationPlan{Kind: "dataset-query", DatasetPlan: &secondPlan}})
	if err != nil {
		t.Fatal(err)
	}
	return first, second
}

func replaceRecurringSource(t *testing.T, service *Service, source DatasetSummary, contents string) DatasetSummary {
	t.Helper()
	path := filepath.Join(t.TempDir(), "replacement.csv")
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := service.ReplaceFile(context.Background(), source.ID, path)
	if err != nil || result.Dataset == nil {
		t.Fatalf("replace recurring source: %#v err=%v", result, err)
	}
	return *result.Dataset
}

func TestDerivedRecomputeQueueAdvancesAChainTopologicallyAndIdempotently(t *testing.T) {
	service, source := importQueryFixture(t)
	first, second := materializeDerivedChain(t, service, source)
	replaced := replaceRecurringSource(t, service, source, "Region,Amount,Status\nNorth,100,paid\nSouth,50,paid\n")

	plan, err := service.GetDerivedDependencyPlan(context.Background(), source.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.OrderedDatasetIDs) != 2 || plan.OrderedDatasetIDs[0] != first.Dataset.ID || plan.OrderedDatasetIDs[1] != second.Dataset.ID {
		t.Fatalf("dependency order is not topological: %#v", plan)
	}
	events, err := service.ProcessDerivedRecomputeEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 || events[0].TargetDatasetID != first.Dataset.ID || events[1].TargetDatasetID != second.Dataset.ID || events[0].Status != "succeeded" || events[1].Status != "succeeded" {
		t.Fatalf("recompute chain did not finish in order: %#v", events)
	}
	thread, err := service.GetConversation(context.Background(), ConversationTarget{Kind: "dataset", ID: second.Dataset.ID})
	if err != nil || thread == nil || len(thread.Entries) != 1 || !strings.Contains(string(thread.Entries[0].Payload), "automation") {
		t.Fatalf("terminal recompute was not delivered as a local task record: %#v err=%v", thread, err)
	}
	firstLineage, _ := service.GetDerivedDatasetLineage(context.Background(), first.Dataset.ID)
	secondLineage, _ := service.GetDerivedDatasetLineage(context.Background(), second.Dataset.ID)
	if firstLineage == nil || firstLineage.Parents[0].VersionID != replaced.VersionID || secondLineage == nil || secondLineage.Parents[0].VersionID != *events[0].ResultVersionID {
		t.Fatalf("recompute chain did not bind current parent versions: first=%#v second=%#v", firstLineage, secondLineage)
	}
	again, err := service.ProcessDerivedRecomputeEvents(context.Background())
	if err != nil || len(again) != 0 {
		t.Fatalf("empty queue was not idempotent: %#v err=%v", again, err)
	}
}

func TestDerivedRecomputePausesOnQualityDriftAndCanBeRemediated(t *testing.T) {
	service, source := importQueryFixture(t)
	plan := DataCleanPlan{SchemaVersion: 1, Purpose: "Recurring status clean", Sources: []DataCleanSource{{DatasetID: source.ID, VersionID: source.VersionID}}, Operations: []DataCleanOperation{{Kind: "select", Columns: []string{"Region", "Status"}}}}
	input := reviewedCleanInput(t, "Recurring clean", plan)
	input.QualityPolicy = &DataCleanQualityPolicy{SchemaVersion: 1, Rules: []DataCleanQualityRule{{ID: "known-status", Severity: "blocking", Kind: "accepted-values", Column: "Status", Values: []string{"paid", "open"}}}}
	_, fingerprint, err := dataCleanQualityPolicyEvidence(*input.QualityPolicy)
	if err != nil {
		t.Fatal(err)
	}
	input.Review.QualityPolicyFingerprint = fingerprint
	created, err := service.MaterializeDerivedDataset(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	originalVersionID := created.Dataset.VersionID
	replaceRecurringSource(t, service, source, "Region,Amount,Status\nNorth,100,unknown\n")
	events, err := service.ProcessDerivedRecomputeEvents(context.Background())
	if err != nil || len(events) != 1 || events[0].Status != "paused" || events[0].ReasonKind == nil || *events[0].ReasonKind != "quality-block" {
		t.Fatalf("quality drift did not pause recompute: %#v err=%v", events, err)
	}
	lineage, _ := service.GetDerivedDatasetLineage(context.Background(), created.Dataset.ID)
	if lineage == nil || lineage.VersionID != originalVersionID {
		t.Fatalf("blocked recompute activated a partial version: %#v", lineage)
	}
	replaceRecurringSource(t, service, source, "Region,Amount,Status\nNorth,100,paid\n")
	retried, err := service.RetryDerivedRecomputeEvent(context.Background(), events[0].ID)
	if err != nil || retried.Status != "pending" {
		t.Fatalf("paused recompute could not be retried: %#v err=%v", retried, err)
	}
	completed, err := service.ProcessDerivedRecomputeEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var retrySucceeded bool
	for _, event := range completed {
		if event.ID == events[0].ID && event.Status == "succeeded" {
			retrySucceeded = true
		}
	}
	if !retrySucceeded {
		t.Fatalf("remediated retry did not succeed: %#v", completed)
	}
	if len(completed) != 1 {
		t.Fatalf("retry did not merge the newer pending task: %#v", completed)
	}
	current, _ := service.ListDatasets(context.Background())
	for _, dataset := range current {
		if dataset.ID == created.Dataset.ID && dataset.Version != 2 {
			t.Fatalf("merged retry created more than one next version: %#v", dataset)
		}
	}
	allEvents, err := service.ListDerivedRecomputeEvents(context.Background(), created.Dataset.ID)
	if err != nil || len(allEvents) != 2 || allEvents[0].Status != "cancelled" || allEvents[1].Status != "succeeded" {
		t.Fatalf("merged retry did not retain bounded task evidence: %#v err=%v", allEvents, err)
	}
	if _, err := service.RetryDerivedRecomputeEvent(context.Background(), events[0].ID); err == nil {
		t.Fatal("a successful retry was accepted twice")
	}
}

func TestDerivedRecomputeRecoveryCancellationAndCycleGuard(t *testing.T) {
	service, source := importQueryFixture(t)
	first, second := materializeDerivedChain(t, service, source)
	replaceRecurringSource(t, service, source, "Region,Amount,Status\nNorth,100,paid\n")
	events, err := service.ListDerivedRecomputeEvents(context.Background(), first.Dataset.ID)
	if err != nil || len(events) != 1 {
		t.Fatalf("missing queued event: %#v err=%v", events, err)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := service.database.Exec("UPDATE derived_recompute_events SET status = 'running', started_at = ?, attempt = 1 WHERE id = ?", now, events[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := recoverInterruptedDerivedRecomputes(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	recovered, err := service.getDerivedRecomputeEvent(context.Background(), events[0].ID)
	if err != nil || recovered.Status != "pending" || recovered.StartedAt != nil || recovered.Attempt != 1 {
		t.Fatalf("interrupted event was not recovered: %#v err=%v", recovered, err)
	}
	cancelled, err := service.CancelDerivedRecomputeEvent(context.Background(), recovered.ID)
	if err != nil || cancelled.Status != "cancelled" || cancelled.ReasonKind == nil || *cancelled.ReasonKind != "cancelled" {
		t.Fatalf("pending event was not cancelled: %#v err=%v", cancelled, err)
	}

	// Forge a current-lineage back edge to prove the runtime rejects corrupt cyclic evidence.
	if _, err := service.database.Exec("INSERT INTO derived_dataset_lineage_parents(derived_version_id, ordinal, parent_dataset_id, parent_version_id, parent_display_name) VALUES (?, 1, ?, ?, ?)", first.Dataset.VersionID, second.Dataset.ID, second.Dataset.VersionID, second.Dataset.DisplayName); err != nil {
		t.Fatal(err)
	}
	if _, err := service.GetDerivedDependencyPlan(context.Background(), first.Dataset.ID); err == nil || !strings.Contains(err.Error(), "cycle") {
		t.Fatalf("cyclic dependency evidence was accepted: %v", err)
	}
	before, _ := service.ListDatasets(context.Background())
	replacement := filepath.Join(t.TempDir(), "cycle.csv")
	if err := os.WriteFile(replacement, []byte("Region,Amount,Status\nNorth,200,paid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ReplaceFile(context.Background(), source.ID, replacement); err == nil || !strings.Contains(err.Error(), "cycle") {
		t.Fatalf("source activation did not fail closed on a cyclic graph: %v", err)
	}
	after, _ := service.ListDatasets(context.Background())
	var beforeVersion, afterVersion int
	for _, dataset := range before {
		if dataset.ID == source.ID {
			beforeVersion = dataset.Version
		}
	}
	for _, dataset := range after {
		if dataset.ID == source.ID {
			afterVersion = dataset.Version
		}
	}
	if beforeVersion == 0 || afterVersion != beforeVersion {
		t.Fatalf("cyclic activation left a partial source version: before=%d after=%d", beforeVersion, afterVersion)
	}
}

func TestDerivedRecomputeEvidenceSurvivesBackupRestore(t *testing.T) {
	service, source := importQueryFixture(t)
	first, _ := materializeDerivedChain(t, service, source)
	replaceRecurringSource(t, service, source, "Region,Amount,Status\nNorth,100,paid\n")
	processed, err := service.ProcessDerivedRecomputeEvents(context.Background())
	if err != nil || len(processed) != 2 {
		t.Fatalf("prepare recompute evidence: %#v err=%v", processed, err)
	}
	backup := filepath.Join(t.TempDir(), "recompute.bubu-backup")
	if _, err := service.CreateBackup(context.Background(), backup); err != nil {
		t.Fatal(err)
	}
	if _, err := service.RestoreBackup(context.Background(), backup); err != nil {
		t.Fatal(err)
	}
	restored, err := service.ListDerivedRecomputeEvents(context.Background(), first.Dataset.ID)
	if err != nil || len(restored) != 1 || restored[0].Status != "succeeded" || restored[0].ResultVersionID == nil {
		t.Fatalf("restored recompute evidence is incomplete: %#v err=%v", restored, err)
	}
}
