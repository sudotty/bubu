package data

const modelAuditPurposeMigrationSQL = `
ALTER TABLE model_disclosure_outcomes RENAME TO model_disclosure_outcomes_v11;
ALTER TABLE model_disclosure_events RENAME TO model_disclosure_events_v11;
DROP INDEX model_disclosure_events_started_idx;

CREATE TABLE model_disclosure_purposes (
    purpose TEXT PRIMARY KEY
) WITHOUT ROWID;

INSERT INTO model_disclosure_purposes(purpose) VALUES
    ('provider-connection-test'),
    ('query-plan'),
    ('group-query-plan'),
    ('aggregate-explanation'),
    ('aggregate-agent');

CREATE TABLE model_disclosure_events (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL REFERENCES model_disclosure_purposes(purpose),
    target_kind TEXT NOT NULL CHECK (target_kind IN ('system', 'dataset', 'group')),
    target_id TEXT NOT NULL,
    disclosure TEXT NOT NULL CHECK (disclosure IN ('none', 'schema-only', 'schema-synthetic', 'aggregates')),
    provider_id TEXT NOT NULL,
    provider_kind TEXT NOT NULL CHECK (provider_kind IN ('openai', 'anthropic', 'gemini', 'openai-compatible', 'ollama')),
    provider_name TEXT NOT NULL,
    model TEXT NOT NULL,
    endpoint_origin TEXT NOT NULL,
    dataset_count INTEGER NOT NULL CHECK (dataset_count BETWEEN 0 AND 8),
    column_count INTEGER NOT NULL CHECK (column_count BETWEEN 0 AND 2048),
    synthetic_row_count INTEGER NOT NULL CHECK (synthetic_row_count BETWEEN 0 AND 40),
    aggregate_row_count INTEGER NOT NULL CHECK (aggregate_row_count BETWEEN 0 AND 50),
    relationship_count INTEGER NOT NULL CHECK (relationship_count BETWEEN 0 AND 500),
    payload_bytes INTEGER NOT NULL CHECK (payload_bytes BETWEEN 1 AND 250000),
    estimated_input_tokens INTEGER NOT NULL CHECK (estimated_input_tokens BETWEEN 1 AND 250000),
    max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 32768),
    payload_sha256 TEXT NOT NULL,
    contains_raw_rows INTEGER NOT NULL CHECK (contains_raw_rows = 0),
    started_at TEXT NOT NULL
);

INSERT INTO model_disclosure_events(
    id, purpose, target_kind, target_id, disclosure, provider_id, provider_kind,
    provider_name, model, endpoint_origin, dataset_count, column_count,
    synthetic_row_count, aggregate_row_count, relationship_count, payload_bytes,
    estimated_input_tokens, max_output_tokens, payload_sha256, contains_raw_rows, started_at
)
SELECT id, purpose, target_kind, target_id, disclosure, provider_id, provider_kind,
       provider_name, model, endpoint_origin, dataset_count, column_count,
       synthetic_row_count, aggregate_row_count, relationship_count, payload_bytes,
       estimated_input_tokens, max_output_tokens, payload_sha256, contains_raw_rows, started_at
FROM model_disclosure_events_v11;

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

INSERT INTO model_disclosure_outcomes(
    disclosure_id, status, input_tokens, output_tokens, total_tokens,
    output_bytes, error, finished_at
)
SELECT disclosure_id, status, input_tokens, output_tokens, total_tokens,
       output_bytes, error, finished_at
FROM model_disclosure_outcomes_v11;

DROP TABLE model_disclosure_outcomes_v11;
DROP TABLE model_disclosure_events_v11;

CREATE INDEX model_disclosure_events_started_idx
ON model_disclosure_events(started_at DESC, id DESC);
`
