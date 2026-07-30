package data

const reconciliationReplayMigration = `
CREATE TABLE reconciliation_definitions (
    id TEXT PRIMARY KEY,
    plan_json TEXT NOT NULL CHECK (length(plan_json) BETWEEN 2 AND 250000 AND json_valid(plan_json)),
    plan_fingerprint TEXT NOT NULL CHECK (length(plan_fingerprint) = 64),
    left_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    right_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    baseline_preview_json TEXT NOT NULL CHECK (length(baseline_preview_json) BETWEEN 2 AND 250000 AND json_valid(baseline_preview_json)),
    last_artifact_id TEXT NOT NULL REFERENCES reconciliation_artifacts(id) ON DELETE RESTRICT,
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX reconciliation_definitions_active_plan_idx ON reconciliation_definitions(plan_fingerprint) WHERE active = 1;
CREATE TABLE reconciliation_replay_events (
    id TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL REFERENCES reconciliation_definitions(id) ON DELETE CASCADE,
    trigger_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    trigger_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE RESTRICT,
    source_signature TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','paused','failed','cancelled')),
    reason_kind TEXT CHECK (reason_kind IS NULL OR reason_kind IN ('schema-drift','cardinality-change','control-total-change','quality-change','stale-source','execution-error','cancelled')),
    error TEXT,
    artifact_id TEXT REFERENCES reconciliation_artifacts(id) ON DELETE RESTRICT,
    attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND 3),
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    UNIQUE(definition_id, source_signature)
);
CREATE INDEX reconciliation_replay_events_status_idx ON reconciliation_replay_events(status, created_at, id);
CREATE INDEX reconciliation_replay_events_definition_idx ON reconciliation_replay_events(definition_id, created_at DESC, id DESC);
`
