package rpc

import (
	"bytes"
	"encoding/json"
	"strings"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

type validationSaveInput struct {
	DatasetID string                `json:"datasetId"`
	Rules     []data.ValidationRule `json:"rules"`
}

func integerParam(params map[string]any, key string) (int, bool) {
	value, ok := params[key].(float64)
	if !ok || value != float64(int(value)) {
		return 0, false
	}
	return int(value), true
}

func optionalStringParam(params map[string]any, key string) (string, bool) {
	value, exists := params[key]
	if !exists {
		return "", true
	}
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return "", false
	}
	return text, true
}

func stringSliceParam(params map[string]any, key string, maximum int) ([]string, bool) {
	values, ok := params[key].([]any)
	if !ok || len(values) == 0 || len(values) > maximum {
		return nil, false
	}
	result := make([]string, len(values))
	for index, value := range values {
		text, ok := value.(string)
		if !ok || strings.TrimSpace(text) == "" || len(text) > 32*1024 {
			return nil, false
		}
		result[index] = text
	}
	return result, true
}

func objectParam[T any](params map[string]any, key string) (T, bool) {
	var result T
	value, ok := params[key]
	if !ok {
		return result, false
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return result, false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return result, false
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return result, false
	}
	return result, true
}
