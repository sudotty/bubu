package data

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

func validateComparisonPlan(plan ComparisonPlan) error {
	if plan.SchemaVersion != 1 || !validCleanName(plan.Purpose) || !objectID.MatchString(plan.Sources.Left.DatasetID) || !objectID.MatchString(plan.Sources.Left.VersionID) || !objectID.MatchString(plan.Sources.Right.DatasetID) || !objectID.MatchString(plan.Sources.Right.VersionID) {
		return errors.New("comparison plan identity is invalid")
	}
	if plan.Sources.Left == plan.Sources.Right {
		return errors.New("comparison sources must identify distinct immutable versions")
	}
	if len(plan.Match.Keys) < 1 || len(plan.Match.Keys) > 8 || !oneOf(plan.Match.Cardinality, "one-to-one", "one-to-many") {
		return errors.New("comparison matching policy is invalid")
	}
	seen := map[string]bool{}
	for _, key := range plan.Match.Keys {
		if !validCleanName(key.LeftColumn) || !validCleanName(key.RightColumn) || len(key.Normalization) > 3 {
			return errors.New("comparison key is invalid")
		}
		pair := key.LeftColumn + "\x00" + key.RightColumn
		if seen[pair] {
			return errors.New("comparison key is duplicated")
		}
		seen[pair] = true
		norms := map[string]bool{}
		for _, normalization := range key.Normalization {
			if !oneOf(normalization, "trim", "case-fold", "collapse-whitespace") || norms[normalization] {
				return errors.New("comparison normalization is invalid")
			}
			norms[normalization] = true
		}
	}
	if plan.Budgets.MaximumCandidatePairs < 1 || plan.Budgets.MaximumCandidatePairs > 1_000_000 || plan.Budgets.TimeoutMS < 100 || plan.Budgets.TimeoutMS > 120_000 {
		return errors.New("comparison budget is invalid")
	}
	if tolerance := plan.Match.AmountTolerance; tolerance != nil && (!validCleanName(tolerance.LeftColumn) || !validCleanName(tolerance.RightColumn) || math.IsNaN(tolerance.Absolute) || math.IsInf(tolerance.Absolute, 0) || tolerance.Absolute < 0 || tolerance.Absolute > 1_000_000_000) {
		return errors.New("comparison amount tolerance is invalid")
	}
	if tolerance := plan.Match.DateTolerance; tolerance != nil && (!validCleanName(tolerance.LeftColumn) || !validCleanName(tolerance.RightColumn) || tolerance.Days < 0 || tolerance.Days > 366) {
		return errors.New("comparison date tolerance is invalid")
	}
	return nil
}

func validateReconciliationPlan(plan ReconciliationPlan) error {
	if plan.SchemaVersion != 1 || !validCleanName(plan.Purpose) || plan.UnresolvedPolicy != "review-required" || len(plan.ControlTotals) < 1 || len(plan.ControlTotals) > 16 {
		return errors.New("reconciliation plan shape is invalid")
	}
	if err := validateComparisonPlan(plan.Comparison); err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, total := range plan.ControlTotals {
		if !validControlID(total.ID) || seen[total.ID] || !validCleanName(total.LeftColumn) || !validCleanName(total.RightColumn) || total.Aggregation != "sum" || math.IsNaN(total.Tolerance) || math.IsInf(total.Tolerance, 0) || total.Tolerance < 0 || total.Tolerance > 1_000_000_000 {
			return errors.New("reconciliation control total is invalid")
		}
		seen[total.ID] = true
	}
	return nil
}

func validControlID(value string) bool {
	if len(value) < 1 || len(value) > 64 || value[0] < 'a' || value[0] > 'z' {
		return false
	}
	for _, char := range value[1:] {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '-' {
			return false
		}
	}
	return true
}

func ExecuteComparison(ctx context.Context, plan ComparisonPlan, left, right []ComparisonRow) (ComparisonExecutionResult, error) {
	if err := validateComparisonPlan(plan); err != nil {
		return ComparisonExecutionResult{}, err
	}
	deadlineCtx, cancel := context.WithTimeout(ctx, time.Duration(plan.Budgets.TimeoutMS)*time.Millisecond)
	defer cancel()
	leftGroups, err := groupComparisonRows(deadlineCtx, plan.Match.Keys, left, true)
	if err != nil {
		return ComparisonExecutionResult{}, err
	}
	rightGroups, err := groupComparisonRows(deadlineCtx, plan.Match.Keys, right, false)
	if err != nil {
		return ComparisonExecutionResult{}, err
	}
	candidates := 0
	for key, leftRows := range leftGroups {
		candidates += len(leftRows) * len(rightGroups[key])
		if candidates > plan.Budgets.MaximumCandidatePairs {
			return ComparisonExecutionResult{}, errors.New("comparison candidate budget exceeded")
		}
	}
	result := ComparisonExecutionResult{Classifications: make([]ComparisonClassification, 0, len(left)+len(right)), CandidatePairs: candidates}
	seenRight := map[string]bool{}
	for key, leftRows := range leftGroups {
		if err := deadlineCtx.Err(); err != nil {
			return ComparisonExecutionResult{}, fmt.Errorf("comparison cancelled: %w", err)
		}
		rightRows := rightGroups[key]
		seenRight[key] = true
		if len(rightRows) == 0 {
			for _, row := range leftRows {
				result.Classifications = append(result.Classifications, classification("left-unmatched", &row, nil, key, "no exact normalized key"))
			}
			continue
		}
		if len(leftRows) > 1 {
			for _, row := range leftRows {
				result.Classifications = append(result.Classifications, classification("left-duplicate", &row, nil, key, "left key is not unique"))
			}
			for _, row := range rightRows {
				result.Classifications = append(result.Classifications, classification("pending", nil, &row, key, "duplicate left candidates require review"))
			}
			continue
		}
		if plan.Match.Cardinality == "one-to-one" && len(rightRows) > 1 {
			for _, row := range rightRows {
				result.Classifications = append(result.Classifications, classification("right-duplicate", nil, &row, key, "right key is not unique"))
			}
			result.Classifications = append(result.Classifications, classification("pending", &leftRows[0], nil, key, "duplicate right candidates require review"))
			continue
		}
		for _, rightRow := range rightRows {
			category, reason := compareTolerances(plan.Match, leftRows[0], rightRow)
			result.Classifications = append(result.Classifications, classification(category, &leftRows[0], &rightRow, key, reason))
		}
	}
	for key, rows := range rightGroups {
		if seenRight[key] {
			continue
		}
		for _, row := range rows {
			result.Classifications = append(result.Classifications, classification("right-unmatched", nil, &row, key, "no exact normalized key"))
		}
	}
	return result, nil
}

func groupComparisonRows(ctx context.Context, keys []ComparisonKey, rows []ComparisonRow, left bool) (map[string][]ComparisonRow, error) {
	groups := map[string][]ComparisonRow{}
	for _, row := range rows {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		parts := make([]string, len(keys))
		for index, key := range keys {
			column := key.RightColumn
			if left {
				column = key.LeftColumn
			}
			value, ok := row.Values[column]
			if !ok {
				value = fmt.Sprintf("\x00null:%t:%d:%s", left, row.RowNumber, column)
			}
			for _, normalization := range key.Normalization {
				switch normalization {
				case "trim":
					value = strings.TrimSpace(value)
				case "case-fold":
					value = strings.ToLower(value)
				case "collapse-whitespace":
					value = strings.Join(strings.Fields(value), " ")
				}
			}
			parts[index] = value
		}
		joined := strings.Join(parts, "\x1f")
		groups[joined] = append(groups[joined], row)
	}
	return groups, nil
}
func classification(category string, left, right *ComparisonRow, key, reason string) ComparisonClassification {
	value := ComparisonClassification{Category: category, Key: key, Reason: reason}
	if left != nil {
		row := left.RowNumber
		value.LeftRowNumber = &row
	}
	if right != nil {
		row := right.RowNumber
		value.RightRowNumber = &row
	}
	return value
}
func compareTolerances(match ComparisonMatch, left, right ComparisonRow) (string, string) {
	tolerated := false
	if amount := match.AmountTolerance; amount != nil {
		l, le := strconv.ParseFloat(left.Values[amount.LeftColumn], 64)
		r, re := strconv.ParseFloat(right.Values[amount.RightColumn], 64)
		if le != nil || re != nil || math.Abs(l-r) > amount.Absolute {
			return "conflict", "amount is invalid or outside reviewed tolerance"
		}
		tolerated = tolerated || l != r
	}
	if date := match.DateTolerance; date != nil {
		l, le := parseComparisonDate(left.Values[date.LeftColumn])
		r, re := parseComparisonDate(right.Values[date.RightColumn])
		if le != nil || re != nil || math.Abs(l.Sub(r).Hours()) > float64(date.Days)*24 {
			return "conflict", "date is invalid or outside reviewed tolerance"
		}
		tolerated = tolerated || !l.Equal(r)
	}
	if tolerated {
		return "tolerance-matched", "within reviewed tolerance"
	}
	return "matched", "exact normalized match"
}
func parseComparisonDate(value string) (time.Time, error) {
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed, nil
	}
	return time.Parse(time.RFC3339, value)
}

func reconciliationPlanEvidence(plan ReconciliationPlan) ([]byte, string, error) {
	if err := validateReconciliationPlan(plan); err != nil {
		return nil, "", err
	}
	raw, err := json.Marshal(plan)
	if err != nil {
		return nil, "", fmt.Errorf("encode reconciliation plan: %w", err)
	}
	digest := sha256.Sum256(raw)
	return raw, hex.EncodeToString(digest[:]), nil
}
