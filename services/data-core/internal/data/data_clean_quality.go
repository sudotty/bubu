package data

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
)

func (service *Service) evaluateDataCleanQuality(ctx context.Context, plan DataCleanPlan, execution derivedExecution, policy DataCleanQualityPolicy) (DataCleanQualityEvidence, error) {
	if err := validateDataCleanQualityPolicy(&policy, plan); err != nil {
		return DataCleanQualityEvidence{}, err
	}
	_, fingerprint, err := dataCleanQualityPolicyEvidence(policy)
	if err != nil {
		return DataCleanQualityEvidence{}, err
	}
	columns := make(map[string]int, len(execution.columns))
	for index, column := range execution.columns {
		columns[column.Label] = index
	}
	sources := make(map[int]cleanTable)
	results := make([]DataCleanQualityResult, 0, len(policy.Rules))
	status := "passed"
	for _, rule := range policy.Rules {
		if err := ctx.Err(); err != nil {
			return DataCleanQualityEvidence{}, err
		}
		result, err := service.evaluateDataCleanQualityRule(ctx, rule, plan, execution.rows, columns, sources)
		if err != nil {
			return DataCleanQualityEvidence{}, err
		}
		results = append(results, result)
		if !result.Passed && rule.Severity == "blocking" {
			status = "blocked"
		} else if !result.Passed && status == "passed" {
			status = "warning"
		}
	}
	return DataCleanQualityEvidence{PolicyFingerprint: fingerprint, Status: status, Results: results}, nil
}

func (service *Service) evaluateDataCleanQualityRule(ctx context.Context, rule DataCleanQualityRule, plan DataCleanPlan, rows [][]any, columns map[string]int, sources map[int]cleanTable) (DataCleanQualityResult, error) {
	result := DataCleanQualityResult{RuleID: rule.ID, Severity: rule.Severity, Kind: rule.Kind, Passed: true, SampleRowNumbers: []int{}}
	columnIndex := func(name string) (int, error) {
		index, ok := columns[name]
		if !ok {
			return 0, fmt.Errorf("quality column %q is unavailable in the clean result", name)
		}
		return index, nil
	}
	addFailure := func(row int) {
		result.FailedRows++
		if len(result.SampleRowNumbers) < maximumValidationSamples {
			result.SampleRowNumbers = append(result.SampleRowNumbers, row+1)
		}
	}
	switch rule.Kind {
	case "row-count":
		result.Observed = fmt.Sprintf("%d 行", len(rows))
		bounds := make([]string, 0, 2)
		if rule.Minimum != nil {
			bounds = append(bounds, fmt.Sprintf("至少 %d 行", *rule.Minimum))
			if len(rows) < *rule.Minimum {
				result.FailedRows = *rule.Minimum - len(rows)
			}
		}
		if rule.Maximum != nil {
			bounds = append(bounds, fmt.Sprintf("至多 %d 行", *rule.Maximum))
			if len(rows) > *rule.Maximum {
				result.FailedRows = len(rows) - *rule.Maximum
			}
		}
		result.Expected = strings.Join(bounds, "且")
	case "non-null":
		index, err := columnIndex(rule.Column)
		if err != nil {
			return result, err
		}
		nonNull := 0
		for rowIndex, row := range rows {
			if row[index] != nil && strings.TrimSpace(derivedCellText(row[index])) != "" {
				nonNull++
			} else {
				addFailure(rowIndex)
			}
		}
		ratio := 1.0
		if len(rows) > 0 {
			ratio = float64(nonNull) / float64(len(rows))
		}
		result.Observed, result.Expected = fmt.Sprintf("非空率 %.1f%%", ratio*100), fmt.Sprintf("非空率至少 %.1f%%", *rule.MinimumRatio*100)
		if ratio >= *rule.MinimumRatio {
			result.FailedRows = 0
			result.SampleRowNumbers = []int{}
		}
	case "unique":
		indexes := make([]int, len(rule.Columns))
		for i, name := range rule.Columns {
			index, err := columnIndex(name)
			if err != nil {
				return result, err
			}
			indexes[i] = index
		}
		counts := make(map[string]int)
		keys := make([]string, len(rows))
		for i, row := range rows {
			parts := make([]string, len(indexes))
			for j, index := range indexes {
				if row[index] == nil {
					parts[j] = "\x00"
				} else {
					parts[j] = "\x01" + derivedCellText(row[index])
				}
			}
			keys[i] = strings.Join(parts, "\x1f")
			counts[keys[i]]++
		}
		for i, key := range keys {
			if counts[key] > 1 {
				addFailure(i)
			}
		}
		result.Observed, result.Expected = fmt.Sprintf("%d 行键值重复", result.FailedRows), "没有重复键值"
	case "accepted-values":
		index, err := columnIndex(rule.Column)
		if err != nil {
			return result, err
		}
		accepted := make(map[string]bool, len(rule.Values))
		for _, value := range rule.Values {
			accepted[value] = true
		}
		for i, row := range rows {
			if row[index] != nil && !accepted[derivedCellText(row[index])] {
				addFailure(i)
			}
		}
		result.Observed, result.Expected = fmt.Sprintf("%d 行超出允许值", result.FailedRows), fmt.Sprintf("仅使用 %d 个允许值", len(rule.Values))
	case "accepted-type":
		index, err := columnIndex(rule.Column)
		if err != nil {
			return result, err
		}
		inference := NewTypeInference()
		for _, row := range rows {
			inference = inference.Observe(derivedCellText(row[index]))
		}
		inferred := string(inference.Type())
		accepted := false
		for _, value := range rule.AcceptedTypes {
			accepted = accepted || value == inferred
		}
		if !accepted {
			result.FailedRows = len(rows)
		}
		result.Observed, result.Expected = "推断类型 "+inferred, "类型属于 "+strings.Join(rule.AcceptedTypes, "、")
	case "relationship-coverage":
		index, err := columnIndex(rule.Column)
		if err != nil {
			return result, err
		}
		source, err := service.cleanQualitySource(ctx, plan, *rule.SourceIndex, sources)
		if err != nil {
			return result, err
		}
		sourceIndex, err := cleanColumnIndex(source.columns, rule.SourceColumn)
		if err != nil {
			return result, fmt.Errorf("quality source column %q is unavailable", rule.SourceColumn)
		}
		accepted := make(map[string]bool)
		for _, row := range source.rows {
			if row[sourceIndex] != nil {
				accepted[*row[sourceIndex]] = true
			}
		}
		matched := 0
		for i, row := range rows {
			if row[index] != nil && accepted[derivedCellText(row[index])] {
				matched++
			} else {
				addFailure(i)
			}
		}
		ratio := 1.0
		if len(rows) > 0 {
			ratio = float64(matched) / float64(len(rows))
		}
		result.Observed, result.Expected = fmt.Sprintf("覆盖率 %.1f%%", ratio*100), fmt.Sprintf("覆盖率至少 %.1f%%", *rule.MinimumRatio*100)
		if ratio >= *rule.MinimumRatio {
			result.FailedRows = 0
			result.SampleRowNumbers = []int{}
		}
	case "aggregate-variance":
		index, err := columnIndex(rule.Column)
		if err != nil {
			return result, err
		}
		source, err := service.cleanQualitySource(ctx, plan, *rule.SourceIndex, sources)
		if err != nil {
			return result, err
		}
		sourceIndex, err := cleanColumnIndex(source.columns, rule.SourceColumn)
		if err != nil {
			return result, fmt.Errorf("quality source column %q is unavailable", rule.SourceColumn)
		}
		outputSum, outputInvalid := cleanNumericSumRows(rows, index)
		sourceSum, sourceInvalid := cleanNumericSumTable(source, sourceIndex)
		change := 0.0
		if sourceSum == 0 {
			if outputSum != 0 {
				change = math.Inf(1)
			}
		} else {
			change = math.Abs(outputSum-sourceSum) / math.Abs(sourceSum)
		}
		if outputInvalid+sourceInvalid > 0 || change > *rule.MaximumRelativeChange {
			result.FailedRows = outputInvalid + sourceInvalid
			if result.FailedRows == 0 {
				result.FailedRows = 1
			}
		}
		result.Observed, result.Expected = fmt.Sprintf("变化 %.2f%%，%d 个无效值", change*100, outputInvalid+sourceInvalid), fmt.Sprintf("变化至多 %.2f%%", *rule.MaximumRelativeChange*100)
	}
	result.Passed = result.FailedRows == 0
	return result, nil
}

func (service *Service) cleanQualitySource(ctx context.Context, plan DataCleanPlan, index int, cache map[int]cleanTable) (cleanTable, error) {
	if table, ok := cache[index]; ok {
		return table, nil
	}
	table, _, err := service.loadCleanSource(ctx, plan.Sources[index], index)
	if err != nil {
		return cleanTable{}, err
	}
	cache[index] = table
	return table, nil
}

func cleanNumericSumRows(rows [][]any, index int) (float64, int) {
	sum, invalid := 0.0, 0
	for _, row := range rows {
		if row[index] == nil {
			continue
		}
		value, err := strconv.ParseFloat(strings.TrimSpace(derivedCellText(row[index])), 64)
		if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
			invalid++
		} else {
			sum += value
		}
	}
	return sum, invalid
}
func cleanNumericSumTable(table cleanTable, index int) (float64, int) {
	sum, invalid := 0.0, 0
	for _, row := range table.rows {
		if row[index] == nil {
			continue
		}
		value, err := strconv.ParseFloat(strings.TrimSpace(*row[index]), 64)
		if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
			invalid++
		} else {
			sum += value
		}
	}
	return sum, invalid
}

func cleanQualityFailureSummary(evidence DataCleanQualityEvidence) string {
	failed := make([]string, 0, len(evidence.Results))
	for _, result := range evidence.Results {
		if !result.Passed && result.Severity == "blocking" {
			failed = append(failed, result.RuleID+"（"+result.Observed+"，要求 "+result.Expected+"）")
		}
	}
	return strings.Join(failed, "; ")
}
