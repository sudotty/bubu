package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
)

const maximumValidationRules = 100

func (service *Service) SaveValidationRules(
	ctx context.Context,
	datasetID string,
	rules []ValidationRule,
) (DatasetQualityReport, error) {
	target, err := service.loadQualityTarget(ctx, datasetID)
	if err != nil {
		return DatasetQualityReport{}, err
	}
	if len(rules) > maximumValidationRules {
		return DatasetQualityReport{}, fmt.Errorf("cannot save more than %d validation rules", maximumValidationRules)
	}
	profiles := make(map[string]ColumnProfile, len(target.columns))
	for _, column := range target.columns {
		profiles[column.Name] = column
	}
	for _, rule := range rules {
		if err := validateRule(rule, profiles); err != nil {
			return DatasetQualityReport{}, err
		}
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DatasetQualityReport{}, fmt.Errorf("begin validation-rule save: %w", err)
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, "DELETE FROM dataset_validation_rules WHERE dataset_id = ?", datasetID); err != nil {
		return DatasetQualityReport{}, fmt.Errorf("replace validation rules: %w", err)
	}
	for index, rule := range rules {
		pattern, valuesJSON, err := storedRuleOperands(rule)
		if err != nil {
			return DatasetQualityReport{}, err
		}
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_validation_rules(
    dataset_id, ordinal, kind, column_name, minimum, maximum, pattern, values_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			datasetID, index, rule.Kind, rule.Column, rule.Minimum, rule.Maximum, pattern, valuesJSON,
		); err != nil {
			return DatasetQualityReport{}, fmt.Errorf("store validation rule %d: %w", index, err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return DatasetQualityReport{}, fmt.Errorf("commit validation rules: %w", err)
	}
	return service.GetQualityReport(ctx, datasetID)
}

func validateRule(rule ValidationRule, profiles map[string]ColumnProfile) error {
	profile, exists := profiles[rule.Column]
	if !exists {
		return fmt.Errorf("validation column %q does not exist", rule.Column)
	}
	switch rule.Kind {
	case "required", "unique":
		if rule.Minimum != nil || rule.Maximum != nil || rule.Pattern != "" || len(rule.Values) != 0 {
			return fmt.Errorf("%s rule has unexpected operands", rule.Kind)
		}
	case "number-range":
		if profile.InferredType != ColumnTypeInteger && profile.InferredType != ColumnTypeReal {
			return fmt.Errorf("number-range rule requires a numeric column, got %q", profile.InferredType)
		}
		if rule.Minimum == nil && rule.Maximum == nil {
			return errors.New("number-range rule needs at least one bound")
		}
		if invalidNumber(rule.Minimum) || invalidNumber(rule.Maximum) {
			return errors.New("number-range bounds must be finite")
		}
		if rule.Minimum != nil && rule.Maximum != nil && *rule.Minimum > *rule.Maximum {
			return errors.New("number-range minimum cannot exceed maximum")
		}
		if rule.Pattern != "" || len(rule.Values) != 0 {
			return errors.New("number-range rule has unexpected operands")
		}
	case "pattern":
		if len(rule.Pattern) == 0 || len(rule.Pattern) > 200 {
			return errors.New("pattern rule must contain 1 to 200 characters")
		}
		if _, err := regexp.Compile(rule.Pattern); err != nil {
			return fmt.Errorf("pattern rule is invalid: %w", err)
		}
		if rule.Minimum != nil || rule.Maximum != nil || len(rule.Values) != 0 {
			return errors.New("pattern rule has unexpected operands")
		}
	case "allowed-values":
		if len(rule.Values) == 0 || len(rule.Values) > 50 {
			return errors.New("allowed-values rule must contain 1 to 50 values")
		}
		seen := make(map[string]struct{}, len(rule.Values))
		for _, value := range rule.Values {
			if len(value) > 500 {
				return errors.New("an allowed value exceeds 500 characters")
			}
			if _, exists := seen[value]; exists {
				return errors.New("allowed values must be unique")
			}
			seen[value] = struct{}{}
		}
		if rule.Minimum != nil || rule.Maximum != nil || rule.Pattern != "" {
			return errors.New("allowed-values rule has unexpected operands")
		}
	default:
		return fmt.Errorf("validation rule kind %q is not supported", rule.Kind)
	}
	return nil
}

func invalidNumber(value *float64) bool {
	return value != nil && (math.IsNaN(*value) || math.IsInf(*value, 0))
}

func storedRuleOperands(rule ValidationRule) (any, any, error) {
	var pattern any
	var valuesJSON any
	if rule.Kind == "pattern" {
		pattern = rule.Pattern
	}
	if rule.Kind == "allowed-values" {
		encoded, err := json.Marshal(rule.Values)
		if err != nil {
			return nil, nil, fmt.Errorf("encode allowed values: %w", err)
		}
		valuesJSON = string(encoded)
	}
	return pattern, valuesJSON, nil
}

func (service *Service) loadValidationRules(
	ctx context.Context,
	target qualityTarget,
) ([]ValidationRule, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT kind, column_name, minimum, maximum, pattern, values_json
FROM dataset_validation_rules
WHERE dataset_id = ?
ORDER BY ordinal`, target.datasetID)
	if err != nil {
		return nil, fmt.Errorf("load validation rules: %w", err)
	}
	defer rows.Close()
	result := make([]ValidationRule, 0)
	for rows.Next() {
		var rule ValidationRule
		var minimum, maximum sql.NullFloat64
		var pattern, valuesJSON sql.NullString
		if err := rows.Scan(&rule.Kind, &rule.Column, &minimum, &maximum, &pattern, &valuesJSON); err != nil {
			return nil, fmt.Errorf("scan validation rule: %w", err)
		}
		if minimum.Valid {
			value := minimum.Float64
			rule.Minimum = &value
		}
		if maximum.Valid {
			value := maximum.Float64
			rule.Maximum = &value
		}
		if pattern.Valid {
			rule.Pattern = pattern.String
		}
		if valuesJSON.Valid {
			if err := json.Unmarshal([]byte(valuesJSON.String), &rule.Values); err != nil {
				return nil, fmt.Errorf("decode allowed values: %w", err)
			}
		}
		result = append(result, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate validation rules: %w", err)
	}
	return result, nil
}
