package data

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func datasetModelAuditInput(dataset DatasetSummary) ModelAuditStartInput {
	return ModelAuditStartInput{
		Purpose: "query-plan", Target: ModelAuditTarget{Kind: "dataset", ID: dataset.ID},
		Disclosure: "schema-synthetic", ProviderID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ProviderKind: "openai", ProviderName: "Audited provider", Model: "model-example",
		EndpointOrigin: "https://api.example.com", DatasetCount: 1, ColumnCount: dataset.ColumnCount,
		SyntheticRowCount: 3, RelationshipCount: 0, PayloadBytes: 2_048,
		EstimatedInputTokens: 683, MaximumOutputTokens: 4_096,
		PayloadSHA256:   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		ContainsRawRows: false,
	}
}

func TestModelAuditPersistsDisclosureAndUsageWithoutPayload(t *testing.T) {
	service, dataset := importQueryFixture(t)
	event, err := service.StartModelAudit(context.Background(), datasetModelAuditInput(dataset))
	if err != nil {
		t.Fatal(err)
	}
	if event.Status != "started" || event.FinishedAt != nil || event.ContainsRawRows {
		t.Fatalf("unexpected initial model audit: %#v", event)
	}
	inputTokens, outputTokens, totalTokens := 100, 20, 120
	finished, err := service.FinishModelAudit(context.Background(), ModelAuditFinishInput{
		ID: event.ID, Status: "succeeded", InputTokens: &inputTokens,
		OutputTokens: &outputTokens, TotalTokens: &totalTokens, OutputBytes: 80,
	})
	if err != nil {
		t.Fatal(err)
	}
	if finished.Status != "succeeded" || finished.TotalTokens == nil || *finished.TotalTokens != 120 {
		t.Fatalf("model usage was not persisted: %#v", finished)
	}
	failure := "must not overwrite the terminal outcome"
	if _, err := service.FinishModelAudit(context.Background(), ModelAuditFinishInput{
		ID: event.ID, Status: "failed", OutputBytes: 0, Error: &failure,
	}); err == nil {
		t.Fatal("model audit terminal outcome was overwritten")
	}
	listed, err := service.ListModelAudits(context.Background())
	if err != nil || len(listed) != 1 || listed[0].PayloadSHA256 == "" {
		t.Fatalf("model audit was not listed: %#v, %v", listed, err)
	}
}

func TestModelAuditFailsClosedAndRecoversInterruptedRequests(t *testing.T) {
	service, dataset := importQueryFixture(t)
	invalid := datasetModelAuditInput(dataset)
	invalid.ContainsRawRows = true
	if _, err := service.StartModelAudit(context.Background(), invalid); err == nil {
		t.Fatal("raw-row model disclosure was accepted")
	}
	event, err := service.StartModelAudit(context.Background(), datasetModelAuditInput(dataset))
	if err != nil {
		t.Fatal(err)
	}
	if err := recoverInterruptedModelAudits(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	recovered, err := service.getModelAudit(context.Background(), event.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Status != "failed" || recovered.Error == nil || recovered.FinishedAt == nil {
		t.Fatalf("interrupted model audit was not closed: %#v", recovered)
	}
}

func TestModelAuditAcceptsOnlyBoundedAggregateAnalysis(t *testing.T) {
	service, dataset := importQueryFixture(t)
	input := datasetModelAuditInput(dataset)
	input.Purpose = "aggregate-explanation"
	input.Disclosure = "aggregates"
	input.SyntheticRowCount = 0
	input.AggregateRowCount = 2
	event, err := service.StartModelAudit(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if event.AggregateRowCount != 2 || event.Disclosure != "aggregates" {
		t.Fatalf("aggregate audit scope was not persisted: %#v", event)
	}
	agent := input
	agent.Purpose = "aggregate-agent"
	if event, err := service.StartModelAudit(context.Background(), agent); err != nil || event.Purpose != "aggregate-agent" {
		t.Fatalf("bounded aggregate agent audit was rejected: %#v, %v", event, err)
	}
	invalid := input
	invalid.AggregateRowCount = 0
	if _, err := service.StartModelAudit(context.Background(), invalid); err == nil {
		t.Fatal("empty aggregate disclosure was accepted")
	}
}

func TestModelAuditPurposeMigrationPreservesVersionElevenLedger(t *testing.T) {
	dataDirectory := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dataDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", filepath.Join(dataDirectory, "bubu.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`); err != nil {
		t.Fatal(err)
	}
	for _, migration := range migrations[:11] {
		if _, err := database.Exec(migration.sql); err != nil {
			t.Fatalf("apply setup migration %d: %v", migration.version, err)
		}
		if _, err := database.Exec("INSERT INTO schema_migrations(version) VALUES (?)", migration.version); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := database.Exec(`
INSERT INTO model_disclosure_events(
  id, purpose, target_kind, target_id, disclosure, provider_id, provider_kind,
  provider_name, model, endpoint_origin, dataset_count, column_count,
  synthetic_row_count, aggregate_row_count, relationship_count, payload_bytes,
  estimated_input_tokens, max_output_tokens, payload_sha256, contains_raw_rows, started_at
) VALUES (?, 'aggregate-explanation', 'dataset', ?, 'aggregates', ?, 'openai',
          'Provider', 'model', 'https://api.example.com', 1, 3, 0, 2, 0, 100, 34, 2048, ?, 0, ?)`,
		"d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1", "e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
		"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1", strings.Repeat("a", 64), "2026-07-17T00:00:00Z",
	); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`
INSERT INTO model_disclosure_outcomes(
  disclosure_id, status, input_tokens, output_tokens, total_tokens,
  output_bytes, error, finished_at
) VALUES (?, 'succeeded', 50, 20, 70, 180, NULL, ?)`,
		"d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1", "2026-07-17T00:00:01Z",
	); err != nil {
		t.Fatal(err)
	}
	if err := validateBackupModelAudits(context.Background(), database, 11); err != nil {
		t.Fatalf("version-eleven ledger is no longer backup-compatible: %v", err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, dataDirectory)
	audits, err := service.ListModelAudits(context.Background())
	if err != nil || len(audits) != 1 || audits[0].Purpose != "aggregate-explanation" ||
		audits[0].Status != "succeeded" || audits[0].TotalTokens == nil || *audits[0].TotalTokens != 70 {
		t.Fatalf("version-eleven model ledger did not migrate: %#v, %v", audits, err)
	}
}

func TestModelAuditMigrationPreservesVersionNineLedger(t *testing.T) {
	dataDirectory := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dataDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", filepath.Join(dataDirectory, "bubu.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`); err != nil {
		t.Fatal(err)
	}
	for _, migration := range migrations[:9] {
		if _, err := database.Exec(migration.sql); err != nil {
			t.Fatalf("apply setup migration %d: %v", migration.version, err)
		}
		if _, err := database.Exec("INSERT INTO schema_migrations(version) VALUES (?)", migration.version); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := database.Exec(`
INSERT INTO model_disclosure_events(
  id, purpose, target_kind, target_id, disclosure, provider_id, provider_kind,
  provider_name, model, endpoint_origin, dataset_count, column_count,
  synthetic_row_count, relationship_count, payload_bytes, estimated_input_tokens,
  max_output_tokens, payload_sha256, contains_raw_rows, started_at
) VALUES (?, 'provider-connection-test', 'system', '', 'none', ?, 'openai',
          'Provider', 'model', 'https://api.example.com', 0, 0, 0, 0, 100, 34, 16, ?, 0, ?)`,
		"a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1", "b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1",
		"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", "2026-07-17T00:00:00Z",
	); err != nil {
		t.Fatal(err)
	}
	if err := validateBackupModelAudits(context.Background(), database, 9); err != nil {
		t.Fatalf("version-nine ledger is no longer backup-compatible: %v", err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, dataDirectory)
	audits, err := service.ListModelAudits(context.Background())
	if err != nil || len(audits) != 1 || audits[0].AggregateRowCount != 0 {
		t.Fatalf("version-nine model ledger did not migrate: %#v, %v", audits, err)
	}
}
