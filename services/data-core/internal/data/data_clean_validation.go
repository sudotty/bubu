package data

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"unicode/utf8"
)

const (
	maximumCleanRows  = 200_000
	maximumCleanBytes = 128 * 1024 * 1024
	maximumCleanCells = 2_000_000
)

type cleanTable struct {
	columns []string
	rows    [][]*string
}

func validateDataCleanPlan(plan DataCleanPlan) error {
	if plan.SchemaVersion != 1 {
		return errors.New("unsupported data-clean plan version")
	}
	if !validCleanName(plan.Purpose) || len(plan.Sources) < 1 || len(plan.Sources) > 8 || len(plan.Operations) < 1 || len(plan.Operations) > 40 {
		return errors.New("data-clean plan shape is invalid")
	}
	seenSources := make(map[string]bool, len(plan.Sources))
	for _, source := range plan.Sources {
		if !objectID.MatchString(source.DatasetID) || !objectID.MatchString(source.VersionID) {
			return errors.New("data-clean source identity is invalid")
		}
		key := source.DatasetID + ":" + source.VersionID
		if seenSources[key] {
			return errors.New("data-clean sources must be unique")
		}
		seenSources[key] = true
	}
	for _, operation := range plan.Operations {
		if err := validateDataCleanOperation(operation, len(plan.Sources)); err != nil {
			return err
		}
	}
	return nil
}

func validateDataCleanOperation(operation DataCleanOperation, sourceCount int) error {
	switch operation.Kind {
	case "select":
		return validateCleanNames(operation.Columns, 1, 256)
	case "rename":
		if !validCleanName(operation.Column) || !validCleanName(operation.Name) {
			return errors.New("data-clean rename is invalid")
		}
	case "cast":
		if !validCleanName(operation.Column) || !oneOf(operation.To, "boolean", "integer", "real", "datetime", "text") || !oneOf(operation.OnInvalid, "reject", "null") {
			return errors.New("data-clean cast is invalid")
		}
	case "replace":
		if !validCleanName(operation.Column) || !oneOf(operation.Mode, "exact", "normalized-text") || !validCleanScalar(operation.Match) || !validCleanScalar(operation.Replacement) {
			return errors.New("data-clean replacement is invalid")
		}
	case "derive":
		if !validCleanName(operation.Name) || operation.Expression == nil {
			return errors.New("data-clean derivation is invalid")
		}
		if err := validateCleanExpression(*operation.Expression); err != nil {
			return err
		}
	case "filter":
		if operation.Predicate == nil || !validCleanName(operation.Predicate.Column) || !oneOf(operation.Predicate.Operator, "equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-null", "is-not-null") {
			return errors.New("data-clean predicate is invalid")
		}
		nullOperator := operation.Predicate.Operator == "is-null" || operation.Predicate.Operator == "is-not-null"
		if (nullOperator && len(operation.Predicate.Value) != 0) || (!nullOperator && !validCleanScalar(operation.Predicate.Value)) {
			return errors.New("data-clean predicate value is invalid")
		}
	case "deduplicate":
		if err := validateCleanNames(operation.Keys, 1, 16); err != nil || !oneOf(operation.Keep, "first", "last") {
			return errors.New("data-clean deduplication is invalid")
		}
	case "fill-missing":
		if !validCleanName(operation.Column) || operation.Fill == nil || !oneOf(operation.Fill.Strategy, "literal", "mean") {
			return errors.New("data-clean fill is invalid")
		}
		if operation.Fill.Strategy == "literal" && !validCleanScalar(operation.Fill.Value) {
			return errors.New("data-clean fill literal is invalid")
		}
		if operation.Fill.Strategy == "mean" && len(operation.Fill.Value) != 0 {
			return errors.New("data-clean mean fill cannot contain a literal")
		}
	case "append":
		if operation.SourceIndex < 1 || operation.SourceIndex >= sourceCount {
			return errors.New("data-clean append source is unavailable")
		}
	case "union":
		if operation.SourceIndex < 1 || operation.SourceIndex >= sourceCount || len(operation.Mapping) < 1 || len(operation.Mapping) > 256 {
			return errors.New("data-clean union source or mapping is invalid")
		}
		seenSource, seenTarget := map[string]bool{}, map[string]bool{}
		for _, mapping := range operation.Mapping {
			if !validCleanName(mapping.Source) || !validCleanName(mapping.Target) || seenSource[mapping.Source] || seenTarget[mapping.Target] {
				return errors.New("data-clean union mapping is invalid or duplicated")
			}
			seenSource[mapping.Source], seenTarget[mapping.Target] = true, true
		}
	default:
		return errors.New("data-clean operation is unsupported")
	}
	return nil
}

func validateCleanExpression(expression DataCleanExpression) error {
	switch expression.Kind {
	case "literal":
		if !validCleanScalar(expression.Value) {
			return errors.New("data-clean literal expression is invalid")
		}
	case "concatenate":
		if err := validateCleanNames(expression.Columns, 1, 8); err != nil || len(expression.Separator) > 64 {
			return errors.New("data-clean concatenate expression is invalid")
		}
	case "arithmetic":
		if !validCleanName(expression.LeftColumn) || !validCleanName(expression.RightColumn) || !oneOf(expression.Operator, "add", "subtract", "multiply", "divide") || !oneOf(expression.OnInvalid, "reject", "null") || !oneOf(expression.DivideByZero, "reject", "null") {
			return errors.New("data-clean arithmetic expression is invalid")
		}
	default:
		return errors.New("data-clean expression is unsupported")
	}
	return nil
}

func validCleanName(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed != "" && utf8.RuneCountInString(trimmed) <= 500
}

func validateCleanNames(values []string, minimum, maximum int) error {
	if len(values) < minimum || len(values) > maximum {
		return errors.New("data-clean column list is outside its bounds")
	}
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		if !validCleanName(value) || seen[value] {
			return errors.New("data-clean column list is invalid or duplicated")
		}
		seen[value] = true
	}
	return nil
}

func validCleanScalar(raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > maximumQueryCellBytes+32 {
		return false
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return false
	}
	switch typed := value.(type) {
	case nil, bool, string:
		return true
	case float64:
		return !math.IsNaN(typed) && !math.IsInf(typed, 0)
	default:
		return false
	}
}

func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}
