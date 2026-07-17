package rpc

import (
	"context"
	"testing"
)

func TestMappedReplacementDelegatesOnlyStrictColumnPairs(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "replace-mapped-1",
		Method:          "dataset.replace.mapped",
		Params: map[string]any{
			"datasetId":  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"sourcePath": "/tmp/sales-week-2.csv",
			"mappings": []any{
				map[string]any{"currentColumn": "Order", "incomingColumn": "Order Number"},
				map[string]any{"currentColumn": "Amount", "incomingColumn": "Total"},
			},
		},
	}, testToken, fake)
	if !response.OK || len(fake.replacedMappings) != 2 || fake.replacedMappings[1].IncomingColumn != "Total" {
		t.Fatalf("unexpected mapped replacement response: %#v mappings=%#v", response, fake.replacedMappings)
	}

	response = HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "replace-mapped-2",
		Method:          "dataset.replace.mapped",
		Params: map[string]any{
			"datasetId":  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"sourcePath": "/tmp/sales-week-2.csv",
			"mappings": []any{
				map[string]any{"currentColumn": "Order", "incomingColumn": "Order Number", "sql": "DROP TABLE datasets"},
			},
		},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown mapping fields escaped strict decoding: %#v", response)
	}
}
