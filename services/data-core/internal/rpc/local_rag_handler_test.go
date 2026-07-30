package rpc

import (
	"context"
	"strings"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) ImportKnowledgeSource(_ context.Context, input data.KnowledgeSourceImportInput) (data.KnowledgeSource, error) {
	return data.KnowledgeSource{SchemaVersion: 1, DisplayName: input.DisplayName}, nil
}
func (fake *fakeDatasets) ListKnowledgeSources(context.Context) ([]data.KnowledgeSource, error) {
	return []data.KnowledgeSource{}, nil
}
func (fake *fakeDatasets) RebuildKnowledgeSource(_ context.Context, id string) (data.KnowledgeSource, error) {
	return data.KnowledgeSource{SchemaVersion: 1, ID: id}, nil
}
func (fake *fakeDatasets) DeleteKnowledgeSource(context.Context, string) error { return nil }
func (fake *fakeDatasets) SearchKnowledge(_ context.Context, input data.KnowledgeSearchInput) (data.KnowledgeSearchResult, error) {
	return data.KnowledgeSearchResult{SchemaVersion: 1, Query: input.Query}, nil
}
func (fake *fakeDatasets) PreviewKnowledgeDisclosure(_ context.Context, purpose string, result data.KnowledgeSearchResult) (data.KnowledgeDisclosurePreview, error) {
	return data.KnowledgeDisclosurePreview{SchemaVersion: 1, Purpose: purpose, Query: result.Query, PayloadSHA256: strings.Repeat("a", 64)}, nil
}

func TestLocalKnowledgeHandlersStrictlyDispatch(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{ProtocolVersion: 1, ID: "knowledge", Auth: testToken, Method: "knowledge.source.import", Params: map[string]any{"input": map[string]any{"sourcePath": "/tmp/policy.md", "displayName": "Policy"}}}, testToken, fake)
	if !response.OK {
		t.Fatalf("strict knowledge import was rejected: %#v", response)
	}
	response = HandleWithData(context.Background(), Request{ProtocolVersion: 1, ID: "knowledge", Auth: testToken, Method: "knowledge.source.import", Params: map[string]any{"input": map[string]any{"sourcePath": "/tmp/policy.md", "displayName": "Policy", "unknown": true}}}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unknown knowledge import fields escaped strict decoding: %#v", response)
	}
}
