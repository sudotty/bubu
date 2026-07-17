package rpc

import (
	"encoding/json"
	"io"
	"testing"
)

func TestServeCancelsAnActiveRequestWithoutConcurrentDataExecution(t *testing.T) {
	inputReader, inputWriter := io.Pipe()
	outputReader, outputWriter := io.Pipe()
	fake := &fakeDatasets{waitForCancellation: true}
	serveDone := make(chan error, 1)
	go func() {
		serveDone <- Serve(inputReader, outputWriter, testToken, fake)
		outputWriter.Close()
	}()
	encoder := json.NewEncoder(inputWriter)
	if err := encoder.Encode(Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "long-request",
		Method:          "dataset.distribution.get",
		Params: map[string]any{
			"datasetId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"column":    "Region",
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err := encoder.Encode(Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "cancel-request",
		Method:          "system.cancel",
		Params:          map[string]any{"requestId": "long-request"},
	}); err != nil {
		t.Fatal(err)
	}
	inputWriter.Close()

	decoder := json.NewDecoder(outputReader)
	responses := make(map[string]Response)
	for len(responses) < 2 {
		var response Response
		if err := decoder.Decode(&response); err != nil {
			t.Fatal(err)
		}
		responses[response.ID] = response
	}
	if response := responses["long-request"]; response.OK || response.Error == nil || response.Error.Code != "CANCELLED" {
		t.Fatalf("active request was not cancelled: %#v", response)
	}
	if response := responses["cancel-request"]; !response.OK {
		t.Fatalf("cancellation control request failed: %#v", response)
	}
	if err := <-serveDone; err != nil {
		t.Fatal(err)
	}
}
