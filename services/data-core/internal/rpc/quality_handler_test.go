package rpc

import (
	"context"
	"testing"
)

func TestQualityRulesUseStrictTypedInputs(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "quality-1",
		Method:          "dataset.validation.save",
		Params: map[string]any{
			"input": map[string]any{
				"datasetId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				"rules": []any{
					map[string]any{"kind": "required", "column": "Region"},
					map[string]any{"kind": "allowed-values", "column": "Region", "values": []any{"North", "South"}},
				},
			},
		},
	}, testToken, fake)
	if !response.OK || len(fake.savedRules) != 2 || fake.savedRules[1].Values[0] != "North" {
		t.Fatalf("unexpected validation save: %#v rules=%#v", response, fake.savedRules)
	}

	response = HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "quality-2",
		Method:          "dataset.validation.save",
		Params: map[string]any{
			"input": map[string]any{
				"datasetId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				"rules": []any{
					map[string]any{"kind": "required", "column": "Region", "sql": "DROP TABLE datasets"},
				},
			},
		},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown validation fields escaped strict decoding: %#v", response)
	}
}
