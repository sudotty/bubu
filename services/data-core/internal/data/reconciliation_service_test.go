package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func importReconciliationFixture(t *testing.T) (*Service, ReconciliationPlan) {
	t.Helper()
	root := t.TempDir()
	leftPath, rightPath := filepath.Join(root, "orders.csv"), filepath.Join(root, "payments.csv")
	if err := os.WriteFile(leftPath, []byte("Order ID,Amount,Date\nA,10,2026-07-01\nB,20,2026-07-02\nC,30,2026-07-03\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(rightPath, []byte("Payment Order,Paid,Payment Date\nA,10.01,2026-07-02\nB,21,2026-07-02\nD,40,2026-07-04\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFiles(context.Background(), []string{leftPath, rightPath})
	if err != nil {
		t.Fatal(err)
	}
	left, right := imported.Datasets[0], imported.Datasets[1]
	plan := ReconciliationPlan{SchemaVersion: 1, Purpose: "订单付款对账", Comparison: ComparisonPlan{SchemaVersion: 1, Purpose: "订单付款比较", Sources: ComparisonSources{Left: ComparisonSource{DatasetID: left.ID, VersionID: left.VersionID}, Right: ComparisonSource{DatasetID: right.ID, VersionID: right.VersionID}}, Match: ComparisonMatch{Keys: []ComparisonKey{{LeftColumn: "Order ID", RightColumn: "Payment Order", Normalization: []string{"trim", "case-fold"}}}, Cardinality: "one-to-one", AmountTolerance: &ComparisonAmountTolerance{LeftColumn: "Amount", RightColumn: "Paid", Absolute: .01}, DateTolerance: &ComparisonDateTolerance{LeftColumn: "Date", RightColumn: "Payment Date", Days: 1}}, Budgets: ComparisonBudgets{MaximumCandidatePairs: 100, TimeoutMS: 5_000}}, ControlTotals: []ReconciliationControlTotal{{ID: "gross", LeftColumn: "Amount", RightColumn: "Paid", Aggregation: "sum", Tolerance: .01}}, UnresolvedPolicy: "review-required"}
	return service, plan
}

func TestReconciliationPreviewAndAtomicArtifact(t *testing.T) {
	service, plan := importReconciliationFixture(t)
	preview, err := service.PreviewReconciliation(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if preview.CandidatePairs != 2 || preview.Counts.ToleranceMatched != 1 || preview.Counts.Conflict != 1 || preview.Counts.LeftUnmatched != 1 || preview.Counts.RightUnmatched != 1 || preview.ControlTotals[0].Balanced {
		t.Fatalf("unexpected preview: %#v", preview)
	}
	var before int
	if err := service.database.QueryRow("SELECT COUNT(*) FROM reconciliation_artifacts").Scan(&before); err != nil || before != 0 {
		t.Fatalf("preview persisted data: %d %v", before, err)
	}
	artifact, err := service.ExecuteReconciliation(context.Background(), plan, ReconciliationReview{Kind: "one-use-approval", PlanFingerprint: preview.PlanFingerprint, ReviewedAt: time.Now().UTC().Format(time.RFC3339Nano)})
	if err != nil {
		t.Fatal(err)
	}
	if artifact.Completion.Status != "completed" || artifact.Completion.ClassificationCount != 4 || artifact.PlanFingerprint != preview.PlanFingerprint {
		t.Fatalf("incomplete artifact: %#v", artifact)
	}
	loaded, err := service.GetReconciliationArtifact(context.Background(), artifact.ID)
	if err != nil || loaded.ID != artifact.ID || loaded.Completion.ClassificationCount != 4 {
		t.Fatalf("durable artifact mismatch: %#v %v", loaded, err)
	}
}

func TestReconciliationControlTotalsUseExactDecimalAccumulation(t *testing.T) {
	left := cleanTable{columns: []string{"Amount"}, rows: [][]*string{{cleanText("0.1")}, {cleanText("0.2")}}}
	right := cleanTable{columns: []string{"Paid"}, rows: [][]*string{{cleanText("0.3")}}}
	leftTotal, err := reconciliationSum(left, "Amount")
	if err != nil {
		t.Fatal(err)
	}
	rightTotal, err := reconciliationSum(right, "Paid")
	if err != nil {
		t.Fatal(err)
	}
	result, err := reconciliationControlTotalResult("decimal", leftTotal, rightTotal, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Balanced || result.Difference != 0 || result.LeftValue != 0.3 || result.RightValue != 0.3 {
		t.Fatalf("exact decimal totals drifted: %#v", result)
	}
}

func TestReconciliationRejectsTamperedExpiredAndCancelledExecutionWithoutPartialArtifact(t *testing.T) {
	service, plan := importReconciliationFixture(t)
	preview, err := service.PreviewReconciliation(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	for name, review := range map[string]ReconciliationReview{
		"tampered": {Kind: "one-use-approval", PlanFingerprint: strings.Repeat("f", 64), ReviewedAt: time.Now().UTC().Format(time.RFC3339Nano)},
		"expired":  {Kind: "one-use-approval", PlanFingerprint: preview.PlanFingerprint, ReviewedAt: time.Now().UTC().Add(-11 * time.Minute).Format(time.RFC3339Nano)},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := service.ExecuteReconciliation(context.Background(), plan, review); err == nil {
				t.Fatal("invalid review was accepted")
			}
		})
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := service.ExecuteReconciliation(ctx, plan, ReconciliationReview{Kind: "one-use-approval", PlanFingerprint: preview.PlanFingerprint, ReviewedAt: time.Now().UTC().Format(time.RFC3339Nano)}); err == nil {
		t.Fatal("cancelled execution succeeded")
	}
	var count int
	if err := service.database.QueryRow("SELECT COUNT(*) FROM reconciliation_artifacts").Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed execution left partial artifact: %d %v", count, err)
	}
}
