package data

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
)

const maximumCleanQualityRules = 40

var qualityRuleID = regexp.MustCompile(`^[a-z][a-z0-9-]{0,63}$`)

func validateDataCleanQualityPolicy(policy *DataCleanQualityPolicy, plan DataCleanPlan) error {
	if policy == nil || policy.SchemaVersion != 1 || len(policy.Rules) == 0 || len(policy.Rules) > maximumCleanQualityRules {
		return errors.New("data-clean quality policy must contain 1 to 40 version-1 rules")
	}
	ids := make(map[string]bool, len(policy.Rules))
	for index, rule := range policy.Rules {
		if !qualityRuleID.MatchString(rule.ID) || ids[rule.ID] || !oneOf(rule.Severity, "blocking", "warning") {
			return fmt.Errorf("data-clean quality rule %d has an invalid id or severity", index+1)
		}
		ids[rule.ID] = true
		if err := validateDataCleanQualityRule(rule, len(plan.Sources)); err != nil {
			return fmt.Errorf("data-clean quality rule %d: %w", index+1, err)
		}
	}
	return nil
}

func validateDataCleanQualityRule(rule DataCleanQualityRule, sourceCount int) error {
	switch rule.Kind {
	case "row-count":
		if rule.Column != "" || rule.MinimumRatio != nil || len(rule.Columns) != 0 || len(rule.Values) != 0 || len(rule.AcceptedTypes) != 0 || rule.SourceIndex != nil || rule.SourceColumn != "" || rule.MaximumRelativeChange != nil {
			return errors.New("row-count has unexpected operands")
		}
		if rule.Minimum == nil && rule.Maximum == nil {
			return errors.New("row-count needs a bound")
		}
		if rule.Minimum != nil && *rule.Minimum < 0 || rule.Maximum != nil && *rule.Maximum < 0 {
			return errors.New("row-count bounds must be non-negative")
		}
		if rule.Minimum != nil && rule.Maximum != nil && *rule.Minimum > *rule.Maximum {
			return errors.New("row-count minimum exceeds maximum")
		}
	case "non-null":
		if rule.Minimum != nil || rule.Maximum != nil || len(rule.Columns) != 0 || len(rule.Values) != 0 || len(rule.AcceptedTypes) != 0 || rule.SourceIndex != nil || rule.SourceColumn != "" || rule.MaximumRelativeChange != nil {
			return errors.New("non-null has unexpected operands")
		}
		if rule.Column == "" || rule.MinimumRatio == nil || *rule.MinimumRatio < 0 || *rule.MinimumRatio > 1 {
			return errors.New("non-null needs a column and ratio from 0 to 1")
		}
	case "unique":
		if rule.Minimum != nil || rule.Maximum != nil || rule.Column != "" || rule.MinimumRatio != nil || len(rule.Values) != 0 || len(rule.AcceptedTypes) != 0 || rule.SourceIndex != nil || rule.SourceColumn != "" || rule.MaximumRelativeChange != nil {
			return errors.New("unique has unexpected operands")
		}
		if len(rule.Columns) == 0 || len(rule.Columns) > 16 {
			return errors.New("unique needs 1 to 16 columns")
		}
	case "accepted-values":
		if rule.Minimum != nil || rule.Maximum != nil || rule.MinimumRatio != nil || len(rule.Columns) != 0 || len(rule.AcceptedTypes) != 0 || rule.SourceIndex != nil || rule.SourceColumn != "" || rule.MaximumRelativeChange != nil {
			return errors.New("accepted-values has unexpected operands")
		}
		if rule.Column == "" || len(rule.Values) == 0 || len(rule.Values) > 50 {
			return errors.New("accepted-values needs a column and 1 to 50 values")
		}
		seen := make(map[string]bool, len(rule.Values))
		for _, value := range rule.Values {
			if len(value) > 500 || seen[value] {
				return errors.New("accepted-values must be bounded and unique")
			}
			seen[value] = true
		}
	case "accepted-type":
		if rule.Minimum != nil || rule.Maximum != nil || rule.MinimumRatio != nil || len(rule.Columns) != 0 || len(rule.Values) != 0 || rule.SourceIndex != nil || rule.SourceColumn != "" || rule.MaximumRelativeChange != nil {
			return errors.New("accepted-type has unexpected operands")
		}
		if rule.Column == "" || len(rule.AcceptedTypes) == 0 || len(rule.AcceptedTypes) > 5 {
			return errors.New("accepted-type needs a column and accepted types")
		}
		seen := make(map[string]bool, len(rule.AcceptedTypes))
		for _, value := range rule.AcceptedTypes {
			if !oneOf(value, "boolean", "integer", "real", "datetime", "text") {
				return errors.New("accepted-type contains an unsupported type")
			}
			if seen[value] {
				return errors.New("accepted types must be unique")
			}
			seen[value] = true
		}
	case "relationship-coverage":
		if rule.Minimum != nil || rule.Maximum != nil || len(rule.Columns) != 0 || len(rule.Values) != 0 || len(rule.AcceptedTypes) != 0 || rule.MaximumRelativeChange != nil {
			return errors.New("relationship-coverage has unexpected operands")
		}
		if rule.Column == "" || rule.SourceColumn == "" || rule.SourceIndex == nil || *rule.SourceIndex < 0 || *rule.SourceIndex >= sourceCount || rule.MinimumRatio == nil || *rule.MinimumRatio < 0 || *rule.MinimumRatio > 1 {
			return errors.New("relationship-coverage operands are invalid")
		}
	case "aggregate-variance":
		if rule.Minimum != nil || rule.Maximum != nil || rule.MinimumRatio != nil || len(rule.Columns) != 0 || len(rule.Values) != 0 || len(rule.AcceptedTypes) != 0 {
			return errors.New("aggregate-variance has unexpected operands")
		}
		if rule.Column == "" || rule.SourceColumn == "" || rule.SourceIndex == nil || *rule.SourceIndex < 0 || *rule.SourceIndex >= sourceCount || rule.MaximumRelativeChange == nil || *rule.MaximumRelativeChange < 0 || *rule.MaximumRelativeChange > 100 {
			return errors.New("aggregate-variance operands are invalid")
		}
	default:
		return errors.New("quality rule kind is unsupported")
	}
	return nil
}

func dataCleanQualityPolicyEvidence(policy DataCleanQualityPolicy) ([]byte, string, error) {
	raw, err := json.Marshal(policy)
	if err != nil {
		return nil, "", fmt.Errorf("encode data-clean quality policy: %w", err)
	}
	if len(raw) > 100_000 {
		return nil, "", errors.New("data-clean quality policy is too large")
	}
	digest := sha256.Sum256(raw)
	return raw, hex.EncodeToString(digest[:]), nil
}
