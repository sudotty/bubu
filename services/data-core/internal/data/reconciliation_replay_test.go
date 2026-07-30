package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func saveReconciliationDefinitionFixture(t *testing.T) (*Service, ReconciliationPlan, ReconciliationDefinition) {
	t.Helper()
	service, plan := importReconciliationFixture(t)
	preview, err := service.PreviewReconciliation(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	artifact, err := service.ExecuteReconciliation(context.Background(), plan, ReconciliationReview{
		Kind:            "one-use-approval",
		PlanFingerprint: preview.PlanFingerprint,
		ReviewedAt:      time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		t.Fatal(err)
	}
	definition, err := service.SaveReconciliationDefinition(context.Background(), artifact.ID)
	if err != nil {
		t.Fatal(err)
	}
	return service, plan, definition
}

func replaceReconciliationLeftSource(t *testing.T, service *Service, plan ReconciliationPlan, contents string) {
	t.Helper()
	replacement := filepath.Join(t.TempDir(), "orders-next.csv")
	if err := os.WriteFile(replacement, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := service.ReplaceFile(context.Background(), plan.Comparison.Sources.Left.DatasetID, replacement)
	if err != nil || result.Status != ReplacementApplied {
		t.Fatalf("replacement failed: %#v %v", result, err)
	}
}

func TestReviewedReconciliationReplaysExactlyOnceOnCompatibleSourceVersion(t *testing.T) {
	service, plan, definition := saveReconciliationDefinitionFixture(t)
	replaceReconciliationLeftSource(t, service, plan, "Order ID,Amount,Date\nA,10,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n")

	events, err := service.ListReconciliationReplayEvents(context.Background(), []string{plan.Comparison.Sources.Left.DatasetID})
	if err != nil || len(events) != 1 || events[0].Status != "pending" {
		t.Fatalf("replay was not enqueued once: %#v %v", events, err)
	}
	processed, err := service.ProcessReconciliationReplayEvents(context.Background())
	if err != nil || len(processed) != 1 || processed[0].Status != "succeeded" || processed[0].ArtifactID == nil {
		t.Fatalf("replay did not succeed: %#v %v", processed, err)
	}
	artifact, err := service.GetReconciliationArtifact(context.Background(), *processed[0].ArtifactID)
	if err != nil || artifact.Completion.ReviewKind != "reviewed-replay" || artifact.Completion.DefinitionID == nil || *artifact.Completion.DefinitionID != definition.ID {
		t.Fatalf("replay evidence is incomplete: %#v %v", artifact, err)
	}
	again, err := service.ProcessReconciliationReplayEvents(context.Background())
	if err != nil || len(again) != 0 {
		t.Fatalf("replay duplicated: %#v %v", again, err)
	}
	if err := validateBackupReconciliationReplay(context.Background(), service.database); err != nil {
		t.Fatalf("completed replay evidence is not backup-safe: %v", err)
	}
}

func TestReviewedReconciliationPausesOnCardinalityControlAndQualityChanges(t *testing.T) {
	cases := map[string]struct {
		contents string
		reason   string
	}{
		"cardinality": {
			contents: "Order ID,Amount,Date\nA,10,2026-08-01\nA,10,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n",
			reason:   "cardinality-change",
		},
		"control": {
			contents: "Order ID,Amount,Date\nA,1000,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n",
			reason:   "control-total-change",
		},
		"quality": {
			contents: "Order ID,Amount,Date\nA,10,\nB,20,2026-08-02\nC,30,2026-08-03\n",
			reason:   "quality-change",
		},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			service, plan, _ := saveReconciliationDefinitionFixture(t)
			replaceReconciliationLeftSource(t, service, plan, testCase.contents)
			processed, err := service.ProcessReconciliationReplayEvents(context.Background())
			if err != nil || len(processed) != 1 || processed[0].Status != "paused" || processed[0].ReasonKind == nil || *processed[0].ReasonKind != testCase.reason {
				t.Fatalf("unsafe replay did not pause: %#v %v", processed, err)
			}
			var artifacts int
			if err := service.database.QueryRow("SELECT COUNT(*) FROM reconciliation_artifacts").Scan(&artifacts); err != nil || artifacts != 1 {
				t.Fatalf("pause left a partial artifact: %d %v", artifacts, err)
			}
			cancelled, err := service.CancelReconciliationReplayEvent(context.Background(), processed[0].ID)
			if err != nil || cancelled.Status != "cancelled" {
				t.Fatalf("pause was not cancellable: %#v %v", cancelled, err)
			}
		})
	}
}

func TestReconciliationReplayRecoversInterruptedRunningState(t *testing.T) {
	service, plan, _ := saveReconciliationDefinitionFixture(t)
	replaceReconciliationLeftSource(t, service, plan, "Order ID,Amount,Date\nA,10,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n")
	if _, found, err := service.claimReconciliationReplay(context.Background()); err != nil || !found {
		t.Fatalf("event was not claimed: %v %v", found, err)
	}
	if err := recoverInterruptedReconciliationReplays(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	processed, err := service.ProcessReconciliationReplayEvents(context.Background())
	if err != nil || len(processed) != 1 || processed[0].Status != "succeeded" || processed[0].Attempt != 2 {
		t.Fatalf("interrupted replay was not recovered: %#v %v", processed, err)
	}
}

func TestReconciliationReplayRecoveryFailsExhaustedRunningState(t *testing.T) {
	service, plan, _ := saveReconciliationDefinitionFixture(t)
	replaceReconciliationLeftSource(t, service, plan, "Order ID,Amount,Date\nA,10,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n")
	claimed, found, err := service.claimReconciliationReplay(context.Background())
	if err != nil || !found {
		t.Fatalf("event was not claimed: %v %v", found, err)
	}
	if _, err := service.database.Exec("UPDATE reconciliation_replay_events SET attempt=3 WHERE id=?", claimed.ID); err != nil {
		t.Fatal(err)
	}
	if err := recoverInterruptedReconciliationReplays(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	events, err := service.ListReconciliationReplayEvents(context.Background(), []string{plan.Comparison.Sources.Left.DatasetID})
	if err != nil || len(events) != 1 {
		t.Fatalf("recovered event is unavailable: %#v %v", events, err)
	}
	event := events[0]
	if event.Status != "failed" || event.Attempt != 3 || event.ReasonKind == nil || *event.ReasonKind != "execution-error" || event.Error == nil || !strings.Contains(*event.Error, "maximum retry attempt") || event.StartedAt == nil || event.FinishedAt == nil {
		t.Fatalf("exhausted running event was left ambiguous: %#v", event)
	}
	processed, err := service.ProcessReconciliationReplayEvents(context.Background())
	if err != nil || len(processed) != 0 {
		t.Fatalf("exhausted event was unexpectedly replayed: %#v %v", processed, err)
	}
}

func TestBackupReconciliationDefinitionValidationRejectsSemanticSourceDrift(t *testing.T) {
	service, plan, _ := saveReconciliationDefinitionFixture(t)
	if err := validateBackupReconciliationReplay(context.Background(), service.database); err != nil {
		t.Fatalf("valid reconciliation replay evidence was rejected: %v", err)
	}
	if _, err := service.database.Exec(`UPDATE reconciliation_definitions SET left_dataset_id=?`, plan.Comparison.Sources.Right.DatasetID); err != nil {
		t.Fatal(err)
	}
	if err := validateBackupReconciliationReplay(context.Background(), service.database); err == nil || !strings.Contains(err.Error(), "inconsistent reconciliation definition") {
		t.Fatalf("semantic source drift was accepted: %v", err)
	}
}

func TestBackupReconciliationReplayValidationRejectsImpossiblePendingState(t *testing.T) {
	service, plan, _ := saveReconciliationDefinitionFixture(t)
	replaceReconciliationLeftSource(t, service, plan, "Order ID,Amount,Date\nA,10,2026-08-01\nB,20,2026-08-02\nC,30,2026-08-03\n")
	if err := validateBackupReconciliationReplay(context.Background(), service.database); err != nil {
		t.Fatalf("valid pending replay was rejected: %v", err)
	}
	if _, err := service.database.Exec(`UPDATE reconciliation_replay_events SET finished_at=? WHERE status='pending'`, time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	if err := validateBackupReconciliationReplay(context.Background(), service.database); err == nil || !strings.Contains(err.Error(), "inconsistent reconciliation replay state") {
		t.Fatalf("impossible pending state was accepted: %v", err)
	}
}
