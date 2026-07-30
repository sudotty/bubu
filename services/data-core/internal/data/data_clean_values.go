package data

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"
)

func cleanScalarCell(raw json.RawMessage) (*string, error) {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, errors.New("invalid data-clean scalar")
	}
	switch typed := value.(type) {
	case nil:
		return nil, nil
	case string:
		return &typed, nil
	case bool:
		text := strconv.FormatBool(typed)
		return &text, nil
	case float64:
		text := strconv.FormatFloat(typed, 'g', -1, 64)
		return &text, nil
	default:
		return nil, errors.New("unsupported data-clean scalar")
	}
}

func cleanCellMissing(value *string) bool {
	return value == nil || strings.TrimSpace(*value) == ""
}

func cleanCellsEqual(left, right *string, mode string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	if mode == "normalized-text" {
		return strings.EqualFold(strings.TrimSpace(*left), strings.TrimSpace(*right))
	}
	return *left == *right
}

func castCleanCell(value *string, target string) (*string, error) {
	if cleanCellMissing(value) {
		return nil, nil
	}
	raw := strings.TrimSpace(*value)
	var text string
	switch target {
	case "text":
		text = *value
	case "boolean":
		switch strings.ToLower(raw) {
		case "true", "1":
			text = "true"
		case "false", "0":
			text = "false"
		default:
			return nil, errors.New("value is not boolean")
		}
	case "integer":
		integer, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return nil, errors.New("value is not an integer")
		}
		text = strconv.FormatInt(integer, 10)
	case "real":
		number, err := strconv.ParseFloat(raw, 64)
		if err != nil || math.IsInf(number, 0) || math.IsNaN(number) {
			return nil, errors.New("value is not a finite number")
		}
		text = strconv.FormatFloat(number, 'g', -1, 64)
	case "datetime":
		parsed, ok := parseCleanTime(raw)
		if !ok {
			return nil, errors.New("value is not a supported date or timestamp")
		}
		text = parsed.UTC().Format(time.RFC3339)
	default:
		return nil, errors.New("unsupported cast target")
	}
	return &text, nil
}

func parseCleanTime(raw string) (time.Time, bool) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func evaluateCleanExpression(columns []string, row []*string, expression DataCleanExpression) (*string, error) {
	switch expression.Kind {
	case "literal":
		return cleanScalarCell(expression.Value)
	case "concatenate":
		indexes, err := cleanColumnIndexes(columns, expression.Columns)
		if err != nil {
			return nil, err
		}
		parts := make([]string, len(indexes))
		for index, columnIndex := range indexes {
			if row[columnIndex] != nil {
				parts[index] = *row[columnIndex]
			}
		}
		value := strings.Join(parts, expression.Separator)
		return &value, nil
	case "arithmetic":
		leftIndex, err := cleanColumnIndex(columns, expression.LeftColumn)
		if err != nil {
			return nil, err
		}
		rightIndex, err := cleanColumnIndex(columns, expression.RightColumn)
		if err != nil {
			return nil, err
		}
		left, leftErr := cleanNumber(row[leftIndex])
		right, rightErr := cleanNumber(row[rightIndex])
		if leftErr != nil || rightErr != nil {
			if expression.OnInvalid == "null" {
				return nil, nil
			}
			return nil, errors.New("arithmetic input is not numeric")
		}
		var result float64
		switch expression.Operator {
		case "add":
			result = left + right
		case "subtract":
			result = left - right
		case "multiply":
			result = left * right
		case "divide":
			if right == 0 {
				if expression.DivideByZero == "null" {
					return nil, nil
				}
				return nil, errors.New("division by zero")
			}
			result = left / right
		}
		if math.IsInf(result, 0) || math.IsNaN(result) {
			return nil, errors.New("arithmetic result is not finite")
		}
		value := strconv.FormatFloat(result, 'g', -1, 64)
		return &value, nil
	default:
		return nil, errors.New("unsupported data-clean expression")
	}
}

func cleanNumber(value *string) (float64, error) {
	if cleanCellMissing(value) {
		return 0, errors.New("numeric value is missing")
	}
	number, err := strconv.ParseFloat(strings.TrimSpace(*value), 64)
	if err != nil || math.IsInf(number, 0) || math.IsNaN(number) {
		return 0, errors.New("value is not numeric")
	}
	return number, nil
}

func evaluateCleanPredicate(cell *string, predicate DataCleanPredicate) (bool, error) {
	switch predicate.Operator {
	case "is-null":
		return cleanCellMissing(cell), nil
	case "is-not-null":
		return !cleanCellMissing(cell), nil
	}
	expected, err := cleanScalarCell(predicate.Value)
	if err != nil {
		return false, err
	}
	if predicate.Operator == "contains" {
		if cell == nil || expected == nil {
			return false, nil
		}
		return strings.Contains(*cell, *expected), nil
	}
	if cell == nil || expected == nil {
		equal := cell == nil && expected == nil
		if predicate.Operator == "equals" {
			return equal, nil
		}
		if predicate.Operator == "not-equals" {
			return !equal, nil
		}
		return false, nil
	}
	comparison := strings.Compare(*cell, *expected)
	if left, leftErr := strconv.ParseFloat(strings.TrimSpace(*cell), 64); leftErr == nil && !math.IsNaN(left) && !math.IsInf(left, 0) {
		if right, rightErr := strconv.ParseFloat(strings.TrimSpace(*expected), 64); rightErr == nil && !math.IsNaN(right) && !math.IsInf(right, 0) {
			comparison = 0
			if left < right {
				comparison = -1
			} else if left > right {
				comparison = 1
			}
		}
	}
	switch predicate.Operator {
	case "equals":
		return comparison == 0, nil
	case "not-equals":
		return comparison != 0, nil
	case "greater-than":
		return comparison > 0, nil
	case "greater-or-equal":
		return comparison >= 0, nil
	case "less-than":
		return comparison < 0, nil
	case "less-or-equal":
		return comparison <= 0, nil
	default:
		return false, errors.New("unsupported data-clean predicate")
	}
}

func deduplicateCleanRows(ctx context.Context, rows [][]*string, indexes []int, keep string) ([][]*string, error) {
	keys := make([]string, len(rows))
	last := make(map[string]int, len(rows))
	for index, row := range rows {
		if err := cleanIterationContext(ctx, index); err != nil {
			return nil, err
		}
		values := make([]*string, len(indexes))
		for keyIndex, columnIndex := range indexes {
			values[keyIndex] = row[columnIndex]
		}
		raw, _ := json.Marshal(values)
		keys[index] = string(raw)
		last[keys[index]] = index
	}
	seen := make(map[string]bool, len(rows))
	result := make([][]*string, 0, len(rows))
	for index, row := range rows {
		if err := cleanIterationContext(ctx, index); err != nil {
			return nil, err
		}
		if keep == "last" {
			if last[keys[index]] == index {
				result = append(result, row)
			}
			continue
		}
		if !seen[keys[index]] {
			seen[keys[index]] = true
			result = append(result, row)
		}
	}
	return result, nil
}

func meanCleanCell(ctx context.Context, rows [][]*string, index int) (*string, error) {
	total, count := 0.0, 0
	for rowIndex, row := range rows {
		if err := cleanIterationContext(ctx, rowIndex); err != nil {
			return nil, err
		}
		if cleanCellMissing(row[index]) {
			continue
		}
		number, err := cleanNumber(row[index])
		if err != nil {
			return nil, errors.New("mean fill requires a numeric column")
		}
		total += number
		count++
	}
	if count == 0 {
		return nil, errors.New("mean fill requires at least one numeric value")
	}
	value := strconv.FormatFloat(total/float64(count), 'g', -1, 64)
	return &value, nil
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
