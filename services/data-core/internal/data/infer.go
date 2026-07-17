package data

import (
	"math"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type TypeInference struct {
	typeName ColumnType
}

func NewTypeInference() TypeInference {
	return TypeInference{typeName: ColumnTypeNull}
}

func (inference TypeInference) Observe(raw string) TypeInference {
	observed := classifyValue(raw)
	inference.typeName = mergeColumnTypes(inference.typeName, observed)
	return inference
}

func (inference TypeInference) Type() ColumnType {
	return inference.typeName
}

func classifyValue(raw string) ColumnType {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ColumnTypeNull
	}
	if strings.EqualFold(value, "true") || strings.EqualFold(value, "false") {
		return ColumnTypeBoolean
	}
	if looksLikeLeadingZeroIdentifier(value) {
		return ColumnTypeText
	}
	if _, err := strconv.ParseInt(value, 10, 64); err == nil {
		return ColumnTypeInteger
	}
	if parsed, err := strconv.ParseFloat(value, 64); err == nil && !math.IsInf(parsed, 0) && !math.IsNaN(parsed) {
		return ColumnTypeReal
	}
	for _, layout := range []string{
		"2006-01-02",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		time.RFC3339,
		"2006/01/02",
		"2006/01/02 15:04:05",
	} {
		if _, err := time.Parse(layout, value); err == nil {
			return ColumnTypeDateTime
		}
	}
	return ColumnTypeText
}

func looksLikeLeadingZeroIdentifier(value string) bool {
	if len(value) < 2 || value[0] != '0' {
		return false
	}
	for _, character := range value {
		if !unicode.IsDigit(character) {
			return false
		}
	}
	return true
}

func mergeColumnTypes(current, observed ColumnType) ColumnType {
	if observed == ColumnTypeNull {
		return current
	}
	if current == ColumnTypeNull || current == observed {
		return observed
	}
	if (current == ColumnTypeInteger && observed == ColumnTypeReal) ||
		(current == ColumnTypeReal && observed == ColumnTypeInteger) {
		return ColumnTypeReal
	}
	return ColumnTypeText
}

func NormalizeHeaders(headers []string) []string {
	normalized := make([]string, len(headers))
	counts := make(map[string]int, len(headers))
	for index, sourceName := range headers {
		name := strings.TrimSpace(sourceName)
		if name == "" {
			name = "Column " + strconv.Itoa(index+1)
		}
		key := strings.ToLower(name)
		counts[key]++
		if counts[key] > 1 {
			name += " (" + strconv.Itoa(counts[key]) + ")"
		}
		normalized[index] = name
	}
	return normalized
}
