package data

import (
	"errors"
	"net/url"
	"strings"
	"time"
)

const (
	maximumModelAuditEvents  = 100_000
	maximumModelPayloadBytes = 250_000
	maximumModelOutputBytes  = 10 * 1024 * 1024
)

func validateModelAuditStart(input ModelAuditStartInput) error {
	if !objectID.MatchString(input.ProviderID) || !validProviderKind(input.ProviderKind) {
		return errors.New("model audit provider identity is invalid")
	}
	if strings.TrimSpace(input.ProviderName) == "" || len(input.ProviderName) > 100 ||
		strings.TrimSpace(input.Model) == "" || len(input.Model) > 200 {
		return errors.New("model audit provider metadata is invalid")
	}
	if !validEndpointOrigin(input.EndpointOrigin) || !validSHA256(input.PayloadSHA256) || input.ContainsRawRows {
		return errors.New("model audit disclosure boundary is invalid")
	}
	if input.PayloadBytes < 1 || input.PayloadBytes > maximumModelPayloadBytes ||
		input.EstimatedInputTokens < 1 || input.EstimatedInputTokens > maximumModelPayloadBytes ||
		input.MaximumOutputTokens < 1 || input.MaximumOutputTokens > 32_768 {
		return errors.New("model audit token or payload budget is invalid")
	}
	if input.DatasetCount < 0 || input.DatasetCount > 8 || input.ColumnCount < 0 || input.ColumnCount > 2_048 ||
		input.SyntheticRowCount < 0 || input.SyntheticRowCount > 40 ||
		input.RelationshipCount < 0 || input.RelationshipCount > 500 {
		return errors.New("model audit context counts are invalid")
	}
	if input.Target.Kind == "system" {
		if input.Target.ID != "" || input.Purpose != "provider-connection-test" || input.Disclosure != "none" ||
			input.DatasetCount != 0 || input.ColumnCount != 0 || input.SyntheticRowCount != 0 || input.RelationshipCount != 0 {
			return errors.New("system model audit cannot disclose dataset context")
		}
		return nil
	}
	if !objectID.MatchString(input.Target.ID) {
		return errors.New("model audit target identity is invalid")
	}
	expectedPurpose := "query-plan"
	validDatasetCount := input.DatasetCount == 1
	if input.Target.Kind == "group" {
		expectedPurpose = "group-query-plan"
		validDatasetCount = input.DatasetCount >= 2
	} else if input.Target.Kind != "dataset" {
		return errors.New("model audit target kind is invalid")
	}
	if input.Purpose != expectedPurpose || input.Disclosure == "none" || !validDatasetCount || input.ColumnCount < 1 {
		return errors.New("model audit data scope is inconsistent")
	}
	expectedSyntheticRows := 0
	if input.Disclosure == "schema-synthetic" {
		expectedSyntheticRows = input.DatasetCount * 3
	} else if input.Disclosure != "schema-only" {
		return errors.New("model audit disclosure level is unsupported")
	}
	if input.SyntheticRowCount != expectedSyntheticRows || (input.Target.Kind == "dataset" && input.RelationshipCount != 0) {
		return errors.New("model audit disclosure counts are inconsistent")
	}
	return nil
}

func validateModelAuditFinish(input ModelAuditFinishInput) error {
	if !objectID.MatchString(input.ID) || (input.Status != "succeeded" && input.Status != "failed" && input.Status != "cancelled") {
		return errors.New("model audit finish identity or status is invalid")
	}
	for _, count := range []*int{input.InputTokens, input.OutputTokens, input.TotalTokens} {
		if count != nil && (*count < 0 || *count > 100_000_000) {
			return errors.New("model audit token usage is invalid")
		}
	}
	if input.OutputBytes < 0 || input.OutputBytes > maximumModelOutputBytes {
		return errors.New("model audit output size is invalid")
	}
	if input.Status == "succeeded" && input.Error != nil {
		return errors.New("successful model audit cannot contain an error")
	}
	if input.Status != "succeeded" && (input.Error == nil || strings.TrimSpace(*input.Error) == "" || len(*input.Error) > 2_000) {
		return errors.New("unsuccessful model audit requires a bounded error")
	}
	return nil
}

func validateModelAuditEvent(event ModelAuditEvent) error {
	if !objectID.MatchString(event.ID) || validateModelAuditStart(event.ModelAuditStartInput) != nil {
		return errors.New("stored model audit identity or disclosure is invalid")
	}
	if _, err := time.Parse(time.RFC3339Nano, event.StartedAt); err != nil {
		return errors.New("stored model audit start time is invalid")
	}
	if event.Status == "started" {
		if event.InputTokens != nil || event.OutputTokens != nil || event.TotalTokens != nil ||
			event.OutputBytes != nil || event.Error != nil || event.FinishedAt != nil {
			return errors.New("stored active model audit contains terminal fields")
		}
		return nil
	}
	if event.FinishedAt == nil || event.OutputBytes == nil {
		return errors.New("stored terminal model audit is incomplete")
	}
	if _, err := time.Parse(time.RFC3339Nano, *event.FinishedAt); err != nil {
		return errors.New("stored model audit finish time is invalid")
	}
	return validateModelAuditFinish(ModelAuditFinishInput{
		ID: event.ID, Status: event.Status, InputTokens: event.InputTokens,
		OutputTokens: event.OutputTokens, TotalTokens: event.TotalTokens,
		OutputBytes: *event.OutputBytes, Error: event.Error,
	})
}

func validEndpointOrigin(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
		parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}
	if parsed.Scheme == "http" {
		host := parsed.Hostname()
		return host == "localhost" || host == "127.0.0.1" || host == "::1"
	}
	return true
}

func validProviderKind(value string) bool {
	return value == "openai" || value == "anthropic" || value == "gemini" ||
		value == "openai-compatible" || value == "ollama"
}

func validSHA256(value string) bool {
	return len(value) == 64 && strings.Trim(value, "0123456789abcdef") == ""
}
