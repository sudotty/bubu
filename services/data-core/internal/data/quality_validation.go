package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const maximumValidationSamples = 20

func (service *Service) evaluateValidationRule(
	ctx context.Context,
	target qualityTarget,
	ruleIndex int,
	rule ValidationRule,
) (ValidationResult, error) {
	physical, exists := target.physicalByName[rule.Column]
	if !exists || !physicalColumnName.MatchString(physical) {
		return ValidationResult{}, fmt.Errorf("validation column %q is unavailable in the current version", rule.Column)
	}
	var failedRows int64
	var samples []int64
	var err error
	switch rule.Kind {
	case "required":
		failedRows, samples, err = service.queryValidationFailures(
			ctx, target.tableName, physical+" IS NULL", nil,
		)
	case "unique":
		predicate := fmt.Sprintf(
			"%s IS NOT NULL AND %s IN (SELECT %s FROM %s WHERE %s IS NOT NULL GROUP BY %s HAVING COUNT(*) > 1)",
			physical, physical, physical, target.tableName, physical, physical,
		)
		failedRows, samples, err = service.queryValidationFailures(ctx, target.tableName, predicate, nil)
	case "number-range":
		predicates := make([]string, 0, 2)
		args := make([]any, 0, 2)
		if rule.Minimum != nil {
			predicates = append(predicates, "CAST("+physical+" AS REAL) < ?")
			args = append(args, *rule.Minimum)
		}
		if rule.Maximum != nil {
			predicates = append(predicates, "CAST("+physical+" AS REAL) > ?")
			args = append(args, *rule.Maximum)
		}
		predicate := physical + " IS NOT NULL AND (" + strings.Join(predicates, " OR ") + ")"
		failedRows, samples, err = service.queryValidationFailures(ctx, target.tableName, predicate, args)
	case "allowed-values":
		placeholders := make([]string, len(rule.Values))
		args := make([]any, len(rule.Values))
		for index, value := range rule.Values {
			placeholders[index] = "?"
			args[index] = value
		}
		predicate := physical + " IS NOT NULL AND " + physical + " NOT IN (" + strings.Join(placeholders, ", ") + ")"
		failedRows, samples, err = service.queryValidationFailures(ctx, target.tableName, predicate, args)
	case "pattern":
		failedRows, samples, err = service.queryPatternFailures(ctx, target.tableName, physical, rule.Pattern)
	default:
		return ValidationResult{}, fmt.Errorf("validation rule kind %q is not supported", rule.Kind)
	}
	if err != nil {
		return ValidationResult{}, err
	}
	return ValidationResult{
		RuleIndex:        ruleIndex,
		Kind:             rule.Kind,
		Column:           rule.Column,
		FailedRows:       failedRows,
		SampleRowNumbers: samples,
	}, nil
}

func (service *Service) queryValidationFailures(
	ctx context.Context,
	tableName string,
	predicate string,
	args []any,
) (int64, []int64, error) {
	if !internalTableName.MatchString(tableName) {
		return 0, nil, errors.New("stored table name failed validation")
	}
	var failedRows int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", tableName, predicate)
	if err := service.database.QueryRowContext(ctx, countQuery, args...).Scan(&failedRows); err != nil {
		return 0, nil, fmt.Errorf("count validation failures: %w", err)
	}
	sampleQuery := fmt.Sprintf(
		"SELECT __row_number FROM %s WHERE %s ORDER BY __row_number LIMIT %d",
		tableName,
		predicate,
		maximumValidationSamples,
	)
	rows, err := service.database.QueryContext(ctx, sampleQuery, args...)
	if err != nil {
		return 0, nil, fmt.Errorf("sample validation failures: %w", err)
	}
	defer rows.Close()
	samples := make([]int64, 0, maximumValidationSamples)
	for rows.Next() {
		var rowNumber int64
		if err := rows.Scan(&rowNumber); err != nil {
			return 0, nil, fmt.Errorf("scan validation failure: %w", err)
		}
		samples = append(samples, rowNumber)
	}
	if err := rows.Err(); err != nil {
		return 0, nil, fmt.Errorf("iterate validation failures: %w", err)
	}
	return failedRows, samples, nil
}

func (service *Service) queryPatternFailures(
	ctx context.Context,
	tableName string,
	physical string,
	pattern string,
) (int64, []int64, error) {
	expression, err := regexp.Compile(pattern)
	if err != nil {
		return 0, nil, fmt.Errorf("compile validation pattern: %w", err)
	}
	query := fmt.Sprintf(
		"SELECT __row_number, %s FROM %s WHERE %s IS NOT NULL ORDER BY __row_number",
		physical,
		tableName,
		physical,
	)
	rows, err := service.database.QueryContext(ctx, query)
	if err != nil {
		return 0, nil, fmt.Errorf("query pattern validation: %w", err)
	}
	defer rows.Close()
	var failedRows int64
	samples := make([]int64, 0, maximumValidationSamples)
	for rows.Next() {
		var rowNumber int64
		var value sql.NullString
		if err := rows.Scan(&rowNumber, &value); err != nil {
			return 0, nil, fmt.Errorf("scan pattern validation: %w", err)
		}
		if value.Valid && !expression.MatchString(value.String) {
			failedRows++
			if len(samples) < maximumValidationSamples {
				samples = append(samples, rowNumber)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return 0, nil, fmt.Errorf("iterate pattern validation: %w", err)
	}
	return failedRows, samples, nil
}
