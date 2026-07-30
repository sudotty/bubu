package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
	"time"
)

func (service *Service) PreviewReconciliation(ctx context.Context, plan ReconciliationPlan) (ReconciliationPreview, error) {
	preview, _, err := service.evaluateReconciliation(ctx, plan)
	return preview, err
}

func (service *Service) ExecuteReconciliation(ctx context.Context, plan ReconciliationPlan, review ReconciliationReview) (ReconciliationArtifact, error) {
	if review.Kind != "one-use-approval" {
		return ReconciliationArtifact{}, errors.New("reconciliation requires one-use reviewed evidence")
	}
	reviewedAt, err := time.Parse(time.RFC3339Nano, review.ReviewedAt)
	if err != nil || reviewedAt.After(time.Now().UTC().Add(time.Minute)) || time.Since(reviewedAt) > 10*time.Minute {
		return ReconciliationArtifact{}, errors.New("reconciliation review is invalid or expired")
	}
	rawPlan, fingerprint, err := reconciliationPlanEvidence(plan)
	if err != nil {
		return ReconciliationArtifact{}, err
	}
	if review.PlanFingerprint != fingerprint {
		return ReconciliationArtifact{}, errors.New("reconciliation reviewed plan fingerprint does not match")
	}
	preview, execution, err := service.evaluateReconciliation(ctx, plan)
	if err != nil {
		return ReconciliationArtifact{}, err
	}
	if preview.PlanFingerprint != review.PlanFingerprint {
		return ReconciliationArtifact{}, errors.New("reconciliation preview fingerprint drifted")
	}
	artifact, err := newReconciliationArtifact(plan, preview, execution, "one-use-approval", nil)
	if err != nil {
		return ReconciliationArtifact{}, err
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ReconciliationArtifact{}, fmt.Errorf("begin reconciliation artifact: %w", err)
	}
	defer transaction.Rollback()
	if err := insertReconciliationArtifact(ctx, transaction, artifact, rawPlan, fingerprint); err != nil {
		return ReconciliationArtifact{}, err
	}
	if err := transaction.Commit(); err != nil {
		return ReconciliationArtifact{}, fmt.Errorf("commit reconciliation artifact: %w", err)
	}
	return artifact, nil
}

func newReconciliationArtifact(plan ReconciliationPlan, preview ReconciliationPreview, execution ComparisonExecutionResult, reviewKind string, definitionID *string) (ReconciliationArtifact, error) {
	id, err := newID()
	if err != nil {
		return ReconciliationArtifact{}, err
	}
	artifact := ReconciliationArtifact{SchemaVersion: 1, ID: id, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), Plan: plan, ReconciliationPreview: preview, Classifications: execution.Classifications}
	artifact.Completion = ReconciliationCompletion{Status: "completed", ClassificationCount: len(execution.Classifications), ReviewKind: reviewKind, DefinitionID: definitionID}
	return artifact, nil
}

func insertReconciliationArtifact(ctx context.Context, transaction *sql.Tx, artifact ReconciliationArtifact, rawPlan []byte, fingerprint string) error {
	rawResult, err := json.Marshal(artifact)
	if err != nil {
		return fmt.Errorf("encode reconciliation artifact: %w", err)
	}
	plan := artifact.Plan
	if _, err := transaction.ExecContext(ctx, `INSERT INTO reconciliation_artifacts(id, plan_json, plan_fingerprint, result_json, left_dataset_id, left_version_id, right_dataset_id, right_version_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, artifact.ID, string(rawPlan), fingerprint, string(rawResult), plan.Comparison.Sources.Left.DatasetID, plan.Comparison.Sources.Left.VersionID, plan.Comparison.Sources.Right.DatasetID, plan.Comparison.Sources.Right.VersionID, artifact.CreatedAt); err != nil {
		return fmt.Errorf("store reconciliation artifact: %w", err)
	}
	return nil
}

func (service *Service) GetReconciliationArtifact(ctx context.Context, id string) (ReconciliationArtifact, error) {
	if !objectID.MatchString(id) {
		return ReconciliationArtifact{}, errors.New("reconciliation artifact id is invalid")
	}
	var raw string
	if err := service.database.QueryRowContext(ctx, "SELECT result_json FROM reconciliation_artifacts WHERE id = ?", id).Scan(&raw); err != nil {
		return ReconciliationArtifact{}, fmt.Errorf("read reconciliation artifact: %w", err)
	}
	var artifact ReconciliationArtifact
	if err := json.Unmarshal([]byte(raw), &artifact); err != nil {
		return ReconciliationArtifact{}, fmt.Errorf("decode reconciliation artifact: %w", err)
	}
	return artifact, nil
}

func (service *Service) evaluateReconciliation(ctx context.Context, plan ReconciliationPlan) (ReconciliationPreview, ComparisonExecutionResult, error) {
	_, fingerprint, err := reconciliationPlanEvidence(plan)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	left, leftParent, err := service.loadCleanSource(ctx, DataCleanSource{DatasetID: plan.Comparison.Sources.Left.DatasetID, VersionID: plan.Comparison.Sources.Left.VersionID}, 0)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	right, rightParent, err := service.loadCleanSource(ctx, DataCleanSource{DatasetID: plan.Comparison.Sources.Right.DatasetID, VersionID: plan.Comparison.Sources.Right.VersionID}, 1)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	leftQuality, err := service.GetQualityReport(ctx, plan.Comparison.Sources.Left.DatasetID)
	if err != nil || leftQuality.VersionID != plan.Comparison.Sources.Left.VersionID {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, errors.New("reconciliation left quality evidence is stale")
	}
	rightQuality, err := service.GetQualityReport(ctx, plan.Comparison.Sources.Right.DatasetID)
	if err != nil || rightQuality.VersionID != plan.Comparison.Sources.Right.VersionID {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, errors.New("reconciliation right quality evidence is stale")
	}
	leftRows, err := comparisonRows(left)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	rightRows, err := comparisonRows(right)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	execution, err := ExecuteComparison(ctx, plan.Comparison, leftRows, rightRows)
	if err != nil {
		return ReconciliationPreview{}, ComparisonExecutionResult{}, err
	}
	controlTotals := make([]ReconciliationControlTotalResult, 0, len(plan.ControlTotals))
	for _, control := range plan.ControlTotals {
		leftValue, err := reconciliationSum(left, control.LeftColumn)
		if err != nil {
			return ReconciliationPreview{}, ComparisonExecutionResult{}, err
		}
		rightValue, err := reconciliationSum(right, control.RightColumn)
		if err != nil {
			return ReconciliationPreview{}, ComparisonExecutionResult{}, err
		}
		controlTotal, err := reconciliationControlTotalResult(control.ID, leftValue, rightValue, control.Tolerance)
		if err != nil {
			return ReconciliationPreview{}, ComparisonExecutionResult{}, err
		}
		controlTotals = append(controlTotals, controlTotal)
	}
	preview := ReconciliationPreview{PlanFingerprint: fingerprint, Sources: []ReconciliationSourceEvidence{{Side: "left", DatasetID: plan.Comparison.Sources.Left.DatasetID, VersionID: plan.Comparison.Sources.Left.VersionID, DisplayName: leftParent.DisplayName, RowCount: len(left.rows), QualityScore: leftQuality.Score}, {Side: "right", DatasetID: plan.Comparison.Sources.Right.DatasetID, VersionID: plan.Comparison.Sources.Right.VersionID, DisplayName: rightParent.DisplayName, RowCount: len(right.rows), QualityScore: rightQuality.Score}}, CandidatePairs: execution.CandidatePairs, Counts: reconciliationCounts(execution.Classifications), ControlTotals: controlTotals, Limitations: []string{"仅执行规范化精确匹配；未决候选不会自动确认", "金额与日期容差只在用户审查的列和预算内生效"}}
	return preview, execution, nil
}

func comparisonRows(table cleanTable) ([]ComparisonRow, error) {
	result := make([]ComparisonRow, len(table.rows))
	for rowIndex, row := range table.rows {
		values := map[string]string{}
		for columnIndex, column := range table.columns {
			if row[columnIndex] != nil {
				values[column] = *row[columnIndex]
			}
		}
		result[rowIndex] = ComparisonRow{RowNumber: rowIndex + 1, Values: values}
	}
	return result, nil
}
func reconciliationSum(table cleanTable, column string) (*big.Rat, error) {
	index := -1
	for i, name := range table.columns {
		if name == column {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, fmt.Errorf("reconciliation control column %q is missing", column)
	}
	total := new(big.Rat)
	for rowIndex, row := range table.rows {
		if row[index] == nil || *row[index] == "" {
			continue
		}
		value, ok := new(big.Rat).SetString(strings.TrimSpace(*row[index]))
		if !ok {
			return nil, fmt.Errorf("reconciliation control column %q row %d is not numeric", column, rowIndex+1)
		}
		total.Add(total, value)
	}
	return total, nil
}

func reconciliationControlTotalResult(id string, left, right *big.Rat, tolerance float64) (ReconciliationControlTotalResult, error) {
	toleranceValue, ok := new(big.Rat).SetString(strconv.FormatFloat(tolerance, 'g', -1, 64))
	if !ok || toleranceValue.Sign() < 0 {
		return ReconciliationControlTotalResult{}, errors.New("reconciliation control tolerance is invalid")
	}
	difference := new(big.Rat).Sub(left, right)
	absoluteDifference := new(big.Rat).Abs(new(big.Rat).Set(difference))
	leftValue, _ := left.Float64()
	rightValue, _ := right.Float64()
	differenceValue, _ := difference.Float64()
	if math.IsNaN(leftValue) || math.IsInf(leftValue, 0) || math.IsNaN(rightValue) || math.IsInf(rightValue, 0) || math.IsNaN(differenceValue) || math.IsInf(differenceValue, 0) {
		return ReconciliationControlTotalResult{}, errors.New("reconciliation control total exceeds the supported numeric range")
	}
	return ReconciliationControlTotalResult{ID: id, LeftValue: leftValue, RightValue: rightValue, Difference: differenceValue, Tolerance: tolerance, Balanced: absoluteDifference.Cmp(toleranceValue) <= 0}, nil
}
func reconciliationCounts(items []ComparisonClassification) ReconciliationCounts {
	counts := ReconciliationCounts{}
	for _, item := range items {
		switch item.Category {
		case "matched":
			counts.Matched++
		case "tolerance-matched":
			counts.ToleranceMatched++
		case "left-unmatched":
			counts.LeftUnmatched++
		case "right-unmatched":
			counts.RightUnmatched++
		case "left-duplicate":
			counts.LeftDuplicate++
		case "right-duplicate":
			counts.RightDuplicate++
		case "conflict":
			counts.Conflict++
		case "pending":
			counts.Pending++
		}
	}
	return counts
}
