package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

func (service *Service) StartModelAudit(
	ctx context.Context,
	input ModelAuditStartInput,
) (ModelAuditEvent, error) {
	if err := validateModelAuditStart(input); err != nil {
		return ModelAuditEvent{}, err
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ModelAuditEvent{}, fmt.Errorf("begin model audit: %w", err)
	}
	defer transaction.Rollback()
	var count int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM model_disclosure_events").Scan(&count); err != nil {
		return ModelAuditEvent{}, fmt.Errorf("count model audits: %w", err)
	}
	if count >= maximumModelAuditEvents {
		return ModelAuditEvent{}, fmt.Errorf("model disclosure ledger reached its %d-event limit", maximumModelAuditEvents)
	}
	if input.Target.Kind != "system" {
		if err := validateConversationTargetExists(ctx, transaction, ConversationTarget(input.Target)); err != nil {
			return ModelAuditEvent{}, fmt.Errorf("validate model audit target: %w", err)
		}
	}
	id, err := newID()
	if err != nil {
		return ModelAuditEvent{}, err
	}
	startedAt := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO model_disclosure_events(
  id, purpose, target_kind, target_id, disclosure, provider_id, provider_kind,
  provider_name, model, endpoint_origin, dataset_count, column_count,
  synthetic_row_count, relationship_count, payload_bytes, estimated_input_tokens,
  max_output_tokens, payload_sha256, contains_raw_rows, started_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
		id, input.Purpose, input.Target.Kind, input.Target.ID, input.Disclosure,
		input.ProviderID, input.ProviderKind, input.ProviderName, input.Model, input.EndpointOrigin,
		input.DatasetCount, input.ColumnCount, input.SyntheticRowCount, input.RelationshipCount,
		input.PayloadBytes, input.EstimatedInputTokens, input.MaximumOutputTokens,
		input.PayloadSHA256, startedAt,
	); err != nil {
		return ModelAuditEvent{}, fmt.Errorf("store model audit: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return ModelAuditEvent{}, fmt.Errorf("commit model audit: %w", err)
	}
	return service.getModelAudit(ctx, id)
}

func (service *Service) FinishModelAudit(
	ctx context.Context,
	input ModelAuditFinishInput,
) (ModelAuditEvent, error) {
	if err := validateModelAuditFinish(input); err != nil {
		return ModelAuditEvent{}, err
	}
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	result, err := service.database.ExecContext(ctx, `
INSERT INTO model_disclosure_outcomes(
  disclosure_id, status, input_tokens, output_tokens, total_tokens,
  output_bytes, error, finished_at
)
SELECT ?, ?, ?, ?, ?, ?, ?, ?
FROM model_disclosure_events events
WHERE events.id = ?
  AND NOT EXISTS (
    SELECT 1 FROM model_disclosure_outcomes outcomes
    WHERE outcomes.disclosure_id = events.id
  )`, input.ID, input.Status, input.InputTokens, input.OutputTokens, input.TotalTokens,
		input.OutputBytes, input.Error, finishedAt, input.ID)
	if err != nil {
		return ModelAuditEvent{}, fmt.Errorf("finish model audit: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return ModelAuditEvent{}, errors.New("model audit was not active")
	}
	return service.getModelAudit(ctx, input.ID)
}

func (service *Service) ListModelAudits(ctx context.Context) ([]ModelAuditEvent, error) {
	rows, err := service.database.QueryContext(ctx, modelAuditSelect+" ORDER BY events.started_at DESC, events.id DESC LIMIT 100")
	if err != nil {
		return nil, fmt.Errorf("list model audits: %w", err)
	}
	defer rows.Close()
	result := make([]ModelAuditEvent, 0)
	for rows.Next() {
		event, err := scanModelAudit(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

func (service *Service) getModelAudit(ctx context.Context, id string) (ModelAuditEvent, error) {
	return scanModelAudit(service.database.QueryRowContext(ctx, modelAuditSelect+" WHERE events.id = ?", id))
}

const modelAuditSelect = `SELECT
  events.id, events.purpose, events.target_kind, events.target_id, events.disclosure,
  events.provider_id, events.provider_kind, events.provider_name, events.model,
  events.endpoint_origin, events.dataset_count, events.column_count,
  events.synthetic_row_count, events.relationship_count, events.payload_bytes,
  events.estimated_input_tokens, events.max_output_tokens, events.payload_sha256,
  events.contains_raw_rows, COALESCE(outcomes.status, 'started'), outcomes.input_tokens,
  outcomes.output_tokens, outcomes.total_tokens, outcomes.output_bytes, outcomes.error,
  events.started_at, outcomes.finished_at
FROM model_disclosure_events events
LEFT JOIN model_disclosure_outcomes outcomes ON outcomes.disclosure_id = events.id`

func scanModelAudit(scanner workflowScanner) (ModelAuditEvent, error) {
	var event ModelAuditEvent
	var inputTokens, outputTokens, totalTokens, outputBytes sql.NullInt64
	var errorText, finishedAt sql.NullString
	if err := scanner.Scan(
		&event.ID, &event.Purpose, &event.Target.Kind, &event.Target.ID, &event.Disclosure,
		&event.ProviderID, &event.ProviderKind, &event.ProviderName, &event.Model,
		&event.EndpointOrigin, &event.DatasetCount, &event.ColumnCount, &event.SyntheticRowCount,
		&event.RelationshipCount, &event.PayloadBytes, &event.EstimatedInputTokens,
		&event.MaximumOutputTokens, &event.PayloadSHA256, &event.ContainsRawRows, &event.Status,
		&inputTokens, &outputTokens, &totalTokens, &outputBytes, &errorText, &event.StartedAt, &finishedAt,
	); errors.Is(err, sql.ErrNoRows) {
		return ModelAuditEvent{}, errors.New("model audit not found")
	} else if err != nil {
		return ModelAuditEvent{}, fmt.Errorf("scan model audit: %w", err)
	}
	event.InputTokens = nullableAuditInt(inputTokens)
	event.OutputTokens = nullableAuditInt(outputTokens)
	event.TotalTokens = nullableAuditInt(totalTokens)
	event.OutputBytes = nullableAuditInt(outputBytes)
	event.Error = nullableString(errorText)
	event.FinishedAt = nullableString(finishedAt)
	if err := validateModelAuditEvent(event); err != nil {
		return ModelAuditEvent{}, err
	}
	return event, nil
}

func nullableAuditInt(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	result := int(value.Int64)
	return &result
}

func recoverInterruptedModelAudits(ctx context.Context, database *sql.DB) error {
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := database.ExecContext(ctx, `
INSERT INTO model_disclosure_outcomes(
  disclosure_id, status, output_bytes, error, finished_at
)
SELECT events.id, 'failed', 0,
       'Application stopped before the model request completed', ?
FROM model_disclosure_events events
LEFT JOIN model_disclosure_outcomes outcomes ON outcomes.disclosure_id = events.id
WHERE outcomes.disclosure_id IS NULL`, finishedAt); err != nil {
		return fmt.Errorf("recover interrupted model audits: %w", err)
	}
	return nil
}
