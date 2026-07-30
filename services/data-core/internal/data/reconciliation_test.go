package data

import (
	"context"
	"testing"
)

func comparisonFixture() ComparisonPlan {
	return ComparisonPlan{SchemaVersion: 1, Purpose: "订单付款核对", Sources: ComparisonSources{Left: ComparisonSource{DatasetID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", VersionID: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}, Right: ComparisonSource{DatasetID: "cccccccccccccccccccccccccccccccc", VersionID: "dddddddddddddddddddddddddddddddd"}}, Match: ComparisonMatch{Keys: []ComparisonKey{{LeftColumn: "order", RightColumn: "payment_order", Normalization: []string{"trim", "case-fold"}}}, Cardinality: "one-to-one", AmountTolerance: &ComparisonAmountTolerance{LeftColumn: "amount", RightColumn: "paid", Absolute: .01}}, Budgets: ComparisonBudgets{MaximumCandidatePairs: 100, TimeoutMS: 1_000}}
}

func TestValidateComparisonAndReconciliationPlans(t *testing.T) {
	valid := comparisonFixture()
	for name, mutate := range map[string]func(*ComparisonPlan){
		"version":            func(plan *ComparisonPlan) { plan.SchemaVersion = 2 },
		"same source":        func(plan *ComparisonPlan) { plan.Sources.Right = plan.Sources.Left },
		"many to many":       func(plan *ComparisonPlan) { plan.Match.Cardinality = "many-to-many" },
		"fuzzy normalizer":   func(plan *ComparisonPlan) { plan.Match.Keys[0].Normalization = []string{"phonetic"} },
		"unbounded":          func(plan *ComparisonPlan) { plan.Budgets.MaximumCandidatePairs = 1_000_001 },
		"negative tolerance": func(plan *ComparisonPlan) { plan.Match.AmountTolerance.Absolute = -1 },
	} {
		t.Run(name, func(t *testing.T) {
			plan := valid
			plan.Match.Keys = append([]ComparisonKey(nil), valid.Match.Keys...)
			tolerance := *valid.Match.AmountTolerance
			plan.Match.AmountTolerance = &tolerance
			mutate(&plan)
			if validateComparisonPlan(plan) == nil {
				t.Fatal("invalid comparison plan accepted")
			}
		})
	}
	reconciliation := ReconciliationPlan{SchemaVersion: 1, Purpose: "对账", Comparison: valid, ControlTotals: []ReconciliationControlTotal{{ID: "gross", LeftColumn: "amount", RightColumn: "paid", Aggregation: "sum", Tolerance: .01}}, UnresolvedPolicy: "review-required"}
	if err := validateReconciliationPlan(reconciliation); err != nil {
		t.Fatalf("valid reconciliation rejected: %v", err)
	}
	reconciliation.UnresolvedPolicy = "auto-confirm"
	if validateReconciliationPlan(reconciliation) == nil {
		t.Fatal("unsafe unresolved policy accepted")
	}
}

func TestExecuteComparisonClassifiesWithoutAutoConfirmingDuplicates(t *testing.T) {
	plan := comparisonFixture()
	left := []ComparisonRow{{RowNumber: 1, Values: map[string]string{"order": " A-1 ", "amount": "10.00"}}, {RowNumber: 2, Values: map[string]string{"order": "B-2", "amount": "20"}}, {RowNumber: 3, Values: map[string]string{"order": "C-3", "amount": "30"}}}
	right := []ComparisonRow{{RowNumber: 10, Values: map[string]string{"payment_order": "a-1", "paid": "10.01"}}, {RowNumber: 11, Values: map[string]string{"payment_order": "B-2", "paid": "21"}}, {RowNumber: 12, Values: map[string]string{"payment_order": "B-2", "paid": "20"}}, {RowNumber: 13, Values: map[string]string{"payment_order": "D-4", "paid": "40"}}}
	result, err := ExecuteComparison(context.Background(), plan, left, right)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, item := range result.Classifications {
		counts[item.Category]++
	}
	if counts["tolerance-matched"] != 1 || counts["right-duplicate"] != 2 || counts["pending"] != 1 || counts["left-unmatched"] != 1 || counts["right-unmatched"] != 1 {
		t.Fatalf("unexpected classifications: %#v", counts)
	}
}

func TestExecuteComparisonFailsAtomicallyOnBudgetAndCancellation(t *testing.T) {
	plan := comparisonFixture()
	plan.Budgets.MaximumCandidatePairs = 2
	rows := []ComparisonRow{{RowNumber: 1, Values: map[string]string{"order": "A", "amount": "1"}}, {RowNumber: 2, Values: map[string]string{"order": "A", "amount": "1"}}}
	right := []ComparisonRow{{RowNumber: 3, Values: map[string]string{"payment_order": "A", "paid": "1"}}, {RowNumber: 4, Values: map[string]string{"payment_order": "A", "paid": "1"}}}
	if result, err := ExecuteComparison(context.Background(), plan, rows, right); err == nil || result.Classifications != nil {
		t.Fatalf("budget failure returned partial result: %#v %v", result, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if result, err := ExecuteComparison(ctx, comparisonFixture(), rows, right); err == nil || result.Classifications != nil {
		t.Fatalf("cancelled execution returned partial result: %#v %v", result, err)
	}
}
