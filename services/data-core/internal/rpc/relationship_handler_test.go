package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) GetGroupRelationships(
	_ context.Context,
	groupID string,
) (data.GroupRelationshipOverview, error) {
	return data.GroupRelationshipOverview{GroupID: groupID, Relationships: []data.DatasetRelationship{}, Candidates: []data.RelationshipCandidate{}}, nil
}

func (fake *fakeDatasets) SaveRelationship(
	_ context.Context,
	input data.DatasetRelationshipSaveInput,
) (data.DatasetRelationship, error) {
	fake.savedRelationship = input
	return data.DatasetRelationship{ID: "dddddddddddddddddddddddddddddddd", Kind: "lookup", Left: input.Left, Right: input.Right, Status: "ready"}, nil
}

func (fake *fakeDatasets) DeleteRelationship(context.Context, string) error { return nil }

func TestRelationshipSaveRejectsUnstructuredJoinPayloads(t *testing.T) {
	fake := &fakeDatasets{}
	input := map[string]any{
		"left": map[string]any{
			"datasetId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"column":    "Region",
		},
		"right": map[string]any{
			"datasetId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			"column":    "Region",
		},
	}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "relationship-1",
		Method:          "dataset.relationship.save",
		Params:          map[string]any{"input": input},
	}, testToken, fake)
	if !response.OK || fake.savedRelationship.Right.Column != "Region" {
		t.Fatalf("unexpected relationship save: %#v input=%#v", response, fake.savedRelationship)
	}

	input["sql"] = "CROSS JOIN secrets"
	response = HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "relationship-2",
		Method:          "dataset.relationship.save",
		Params:          map[string]any{"input": input},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unstructured join payload escaped strict decoding: %#v", response)
	}
}
