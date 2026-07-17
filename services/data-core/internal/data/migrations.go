package data

import (
	"context"
	"database/sql"
	"fmt"
)

type migration struct {
	version int
	sql     string
}

var migrations = []migration{
	{
		version: 1,
		sql: `
CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('csv', 'xlsx', 'derived')),
    source_name TEXT NOT NULL,
    current_version_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE dataset_versions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal > 0),
    table_name TEXT NOT NULL UNIQUE,
    source_sha256 TEXT NOT NULL,
    source_size INTEGER NOT NULL CHECK (source_size >= 0),
    imported_at TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    column_count INTEGER NOT NULL CHECK (column_count > 0),
    status TEXT NOT NULL CHECK (status IN ('importing', 'ready', 'failed')),
    UNIQUE (dataset_id, ordinal)
);

CREATE TABLE dataset_columns (
    version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    source_name TEXT NOT NULL,
    name TEXT NOT NULL,
    physical_name TEXT NOT NULL,
    inferred_type TEXT NOT NULL CHECK (inferred_type IN ('null', 'boolean', 'integer', 'real', 'datetime', 'text')),
    nullable INTEGER NOT NULL CHECK (nullable IN (0, 1)),
    null_count INTEGER NOT NULL CHECK (null_count >= 0),
    distinct_count INTEGER NOT NULL CHECK (distinct_count >= 0),
    min_value TEXT,
    max_value TEXT,
    PRIMARY KEY (version_id, ordinal),
    UNIQUE (version_id, name),
    UNIQUE (version_id, physical_name)
);

CREATE INDEX dataset_versions_dataset_id_idx ON dataset_versions(dataset_id);
CREATE INDEX dataset_columns_version_id_idx ON dataset_columns(version_id);
`,
	},
	{
		version: 2,
		sql: `
ALTER TABLE datasets ADD COLUMN source_locator TEXT NOT NULL DEFAULT '';
`,
	},
	{
		version: 3,
		sql: `
CREATE TABLE dataset_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE dataset_group_members (
    group_id TEXT NOT NULL REFERENCES dataset_groups(id) ON DELETE CASCADE,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    PRIMARY KEY (group_id, dataset_id),
    UNIQUE (group_id, ordinal)
);

CREATE INDEX dataset_group_members_dataset_id_idx ON dataset_group_members(dataset_id);
`,
	},
	{
		version: 4,
		sql: `
CREATE TABLE conversation_threads (
    id TEXT PRIMARY KEY,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('dataset', 'group')),
    target_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (target_kind, target_id)
);

CREATE TABLE conversation_entries (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal > 0),
    kind TEXT NOT NULL CHECK (kind IN ('question', 'plan', 'result', 'error')),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (thread_id, ordinal),
    CHECK (
        (kind = 'question' AND role = 'user') OR
        (kind IN ('plan', 'result') AND role = 'assistant') OR
        (kind = 'error' AND role = 'system')
    )
);

CREATE INDEX conversation_entries_thread_id_idx ON conversation_entries(thread_id, ordinal);
`,
	},
	{
		version: 5,
		sql: `
CREATE TABLE dataset_validation_rules (
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    kind TEXT NOT NULL CHECK (kind IN ('required', 'unique', 'number-range', 'pattern', 'allowed-values')),
    column_name TEXT NOT NULL,
    minimum REAL,
    maximum REAL,
    pattern TEXT,
    values_json TEXT,
    PRIMARY KEY (dataset_id, ordinal),
    CHECK (
        (kind IN ('required', 'unique') AND minimum IS NULL AND maximum IS NULL AND pattern IS NULL AND values_json IS NULL) OR
        (kind = 'number-range' AND (minimum IS NOT NULL OR maximum IS NOT NULL) AND pattern IS NULL AND values_json IS NULL) OR
        (kind = 'pattern' AND minimum IS NULL AND maximum IS NULL AND pattern IS NOT NULL AND values_json IS NULL) OR
        (kind = 'allowed-values' AND minimum IS NULL AND maximum IS NULL AND pattern IS NULL AND values_json IS NOT NULL)
    )
);
`,
	},
	{
		version: 6,
		sql: `
CREATE TABLE dataset_relationships (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind = 'lookup'),
    left_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    left_column TEXT NOT NULL,
    right_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    right_column TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (left_dataset_id <> right_dataset_id),
    UNIQUE (left_dataset_id, left_column, right_dataset_id, right_column)
);

CREATE INDEX dataset_relationships_left_dataset_idx ON dataset_relationships(left_dataset_id);
CREATE INDEX dataset_relationships_right_dataset_idx ON dataset_relationships(right_dataset_id);
`,
	},
	{
		version: 7,
		sql: `
CREATE TABLE workflow_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('dataset', 'group')),
    target_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    trigger_kind TEXT NOT NULL CHECK (trigger_kind = 'manual'),
    timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 600000),
    steps_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX workflow_definitions_target_idx
ON workflow_definitions(target_kind, target_id, updated_at);

CREATE TABLE workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id),
    definition_version INTEGER NOT NULL CHECK (definition_version > 0),
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT,
    UNIQUE (workflow_id, idempotency_key)
);

CREATE INDEX workflow_runs_workflow_idx
ON workflow_runs(workflow_id, started_at DESC);

CREATE TABLE workflow_step_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
    kind TEXT NOT NULL CHECK (kind IN ('dataset-query', 'group-query')),
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 3),
    resolved_input_json TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (run_id, ordinal, attempt)
);

CREATE INDEX workflow_step_runs_run_idx
ON workflow_step_runs(run_id, ordinal, attempt);
`,
	},
	{
		version: 8,
		sql: `
CREATE TABLE model_disclosure_events (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL CHECK (purpose IN ('provider-connection-test', 'query-plan', 'group-query-plan')),
    target_kind TEXT NOT NULL CHECK (target_kind IN ('system', 'dataset', 'group')),
    target_id TEXT NOT NULL,
    disclosure TEXT NOT NULL CHECK (disclosure IN ('none', 'schema-only', 'schema-synthetic')),
    provider_id TEXT NOT NULL,
    provider_kind TEXT NOT NULL CHECK (provider_kind IN ('openai', 'anthropic', 'gemini', 'openai-compatible', 'ollama')),
    provider_name TEXT NOT NULL,
    model TEXT NOT NULL,
    endpoint_origin TEXT NOT NULL,
    dataset_count INTEGER NOT NULL CHECK (dataset_count BETWEEN 0 AND 8),
    column_count INTEGER NOT NULL CHECK (column_count BETWEEN 0 AND 2048),
    synthetic_row_count INTEGER NOT NULL CHECK (synthetic_row_count BETWEEN 0 AND 40),
    relationship_count INTEGER NOT NULL CHECK (relationship_count BETWEEN 0 AND 500),
    payload_bytes INTEGER NOT NULL CHECK (payload_bytes BETWEEN 1 AND 250000),
    estimated_input_tokens INTEGER NOT NULL CHECK (estimated_input_tokens BETWEEN 1 AND 250000),
    max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 32768),
    payload_sha256 TEXT NOT NULL,
    contains_raw_rows INTEGER NOT NULL CHECK (contains_raw_rows = 0),
    started_at TEXT NOT NULL
);

CREATE TABLE model_disclosure_outcomes (
    disclosure_id TEXT PRIMARY KEY REFERENCES model_disclosure_events(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'cancelled')),
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    output_bytes INTEGER NOT NULL CHECK (output_bytes BETWEEN 0 AND 10485760),
    error TEXT,
    finished_at TEXT NOT NULL
);

CREATE INDEX model_disclosure_events_started_idx
ON model_disclosure_events(started_at DESC, id DESC);
`,
	},
	{
		version: 9,
		sql: `
ALTER TABLE workflow_definitions
ADD COLUMN trigger_json TEXT NOT NULL DEFAULT '{"kind":"manual"}';

ALTER TABLE workflow_definitions
ADD COLUMN next_due_at TEXT;

ALTER TABLE workflow_definitions
ADD COLUMN target_signature TEXT NOT NULL DEFAULT '';

CREATE TABLE workflow_trigger_events (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id),
    definition_version INTEGER NOT NULL CHECK (definition_version > 0),
    operation_id TEXT NOT NULL UNIQUE,
    trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('interval', 'dataset-version')),
    dedupe_key TEXT NOT NULL,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    run_id TEXT REFERENCES workflow_runs(id),
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (workflow_id, dedupe_key)
);

CREATE INDEX workflow_trigger_events_status_idx
ON workflow_trigger_events(status, due_at, id);
`,
	},
	{
		version: 10,
		sql:     modelAuditAggregateMigrationSQL,
	},
	{
		version: 11,
		sql:     conversationInsightMigrationSQL,
	},
	{
		version: 12,
		sql:     modelAuditPurposeMigrationSQL,
	},
}

func applyMigrations(ctx context.Context, database *sql.DB) error {
	if _, err := database.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`); err != nil {
		return fmt.Errorf("create migration table: %w", err)
	}

	for _, item := range migrations {
		var exists int
		err := database.QueryRowContext(ctx, "SELECT 1 FROM schema_migrations WHERE version = ?", item.version).Scan(&exists)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return fmt.Errorf("read migration %d: %w", item.version, err)
		}
		transaction, err := database.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin migration %d: %w", item.version, err)
		}
		if _, err := transaction.ExecContext(ctx, item.sql); err != nil {
			transaction.Rollback()
			return fmt.Errorf("apply migration %d: %w", item.version, err)
		}
		if _, err := transaction.ExecContext(ctx, "INSERT INTO schema_migrations(version) VALUES (?)", item.version); err != nil {
			transaction.Rollback()
			return fmt.Errorf("record migration %d: %w", item.version, err)
		}
		if err := transaction.Commit(); err != nil {
			return fmt.Errorf("commit migration %d: %w", item.version, err)
		}
	}
	return nil
}
