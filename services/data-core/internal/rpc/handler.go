package rpc

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
)

func DecodeRequest(raw []byte) (Request, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var request Request
	if err := decoder.Decode(&request); err != nil {
		return Request{}, fmt.Errorf("decode request: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return Request{}, err
	}
	if request.ProtocolVersion != ProtocolVersion {
		return Request{}, fmt.Errorf("unsupported protocol version: %d", request.ProtocolVersion)
	}
	if len(request.Auth) < 32 {
		return Request{}, errors.New("process credential is missing or too short")
	}
	if strings.TrimSpace(request.ID) == "" || len(request.ID) > 128 {
		return Request{}, errors.New("request id is invalid")
	}
	if strings.TrimSpace(request.Method) == "" {
		return Request{}, errors.New("request method is invalid")
	}
	if request.Params == nil {
		return Request{}, errors.New("request params must be an object")
	}
	return request, nil
}

func ensureJSONEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request contains multiple JSON values")
		}
		return fmt.Errorf("decode trailing data: %w", err)
	}
	return nil
}

func Handle(request Request, expectedAuth string) Response {
	if request.Auth != expectedAuth {
		return failure(request.ID, "UNAUTHORIZED", "Invalid process credential", false)
	}

	if request.Method == "system.health" {
		return success(request.ID, ServiceHealth{
			Service:         "data-core",
			ProtocolVersion: ProtocolVersion,
			Status:          "ready",
			Capabilities:    []string{"local-rpc"},
		})
	}

	return failure(request.ID, "METHOD_NOT_FOUND", "Unknown data-core method", false)
}

func success(id string, result any) Response {
	return Response{ProtocolVersion: ProtocolVersion, ID: id, OK: true, Result: result}
}

func failure(id, code, message string, retryable bool) Response {
	return Response{
		ProtocolVersion: ProtocolVersion,
		ID:              id,
		OK:              false,
		Error:           &Error{Code: code, Message: message, Retryable: retryable},
	}
}
