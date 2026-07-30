package rpc

import (
	"context"
	"strings"
	"testing"
)

func TestConversationEntryPageRequiresAnExplicitBoundedCursor(t *testing.T) {
	request := Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "conversation-page-1",
		Method:          "conversation.entries.page",
		Params: map[string]any{
			"threadId":      "a" + strings.Repeat("0", 31),
			"beforeOrdinal": float64(501),
			"limit":         float64(100),
		},
	}
	response := HandleWithData(context.Background(), request, testToken, &fakeDatasets{})
	if !response.OK {
		t.Fatalf("valid conversation page was rejected: %#v", response)
	}
	request.Params["limit"] = "all"
	response = HandleWithData(context.Background(), request, testToken, &fakeDatasets{})
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" {
		t.Fatalf("unbounded conversation page escaped RPC validation: %#v", response)
	}
}
