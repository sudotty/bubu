package rpc

import (
	"encoding/json"
	"testing"
)

const testToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func TestHandleHealth(t *testing.T) {
	request := Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "health-1",
		Method:          "system.health",
		Params:          map[string]any{},
	}

	response := Handle(request, testToken)
	if !response.OK {
		t.Fatalf("expected success, got %#v", response.Error)
	}

	encoded, err := json.Marshal(response.Result)
	if err != nil {
		t.Fatal(err)
	}
	var health ServiceHealth
	if err := json.Unmarshal(encoded, &health); err != nil {
		t.Fatal(err)
	}
	if health.Service != "data-core" || health.Status != "ready" {
		t.Fatalf("unexpected health result: %#v", health)
	}
}

func TestHandleHealthAdvertisesCancellationWhenDataServiceIsAvailable(t *testing.T) {
	response := HandleWithData(t.Context(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "health-with-data",
		Method:          "system.health",
		Params:          map[string]any{},
	}, testToken, &fakeDatasets{})
	if !response.OK {
		t.Fatalf("expected success, got %#v", response.Error)
	}
	encoded, err := json.Marshal(response.Result)
	if err != nil {
		t.Fatal(err)
	}
	var health ServiceHealth
	if err := json.Unmarshal(encoded, &health); err != nil {
		t.Fatal(err)
	}
	for _, capability := range health.Capabilities {
		if capability == "cancellable-requests" {
			return
		}
	}
	t.Fatalf("expected cancellable-requests capability, got %#v", health.Capabilities)
}

func TestHandleRejectsWrongToken(t *testing.T) {
	response := Handle(Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "health-1",
		Method:          "system.health",
		Params:          map[string]any{},
	}, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

	if response.OK || response.Error == nil || response.Error.Code != "UNAUTHORIZED" {
		t.Fatalf("expected unauthorized response, got %#v", response)
	}
}

func TestDecodeRequestRejectsUnknownVersion(t *testing.T) {
	_, err := DecodeRequest([]byte(`{"protocolVersion":2,"auth":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","id":"one","method":"system.health","params":{}}`))
	if err == nil {
		t.Fatal("expected unsupported protocol version to fail")
	}
}

func TestHandleRejectsUnknownMethod(t *testing.T) {
	response := Handle(Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "unknown-1",
		Method:          "dataset.destroy",
		Params:          map[string]any{},
	}, testToken)

	if response.OK || response.Error == nil || response.Error.Code != "METHOD_NOT_FOUND" {
		t.Fatalf("expected method-not-found response, got %#v", response)
	}
}
