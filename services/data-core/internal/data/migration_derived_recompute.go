package data

const derivedRecomputeMigrationSQL = `
CREATE TABLE derived_recompute_events (
    id TEXT PRIMARY KEY CHECK (length(id) = 32),
    source_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    source_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    target_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    dedupe_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'paused', 'failed', 'cancelled')),
    reason_kind TEXT CHECK (reason_kind IS NULL OR reason_kind IN ('schema-drift', 'quality-block', 'stale-source', 'execution-error', 'cancelled')),
    error TEXT CHECK (error IS NULL OR length(error) BETWEEN 1 AND 2000),
    result_version_id TEXT REFERENCES dataset_versions(id) ON DELETE SET NULL,
    attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    CHECK (
      (status = 'pending' AND started_at IS NULL AND finished_at IS NULL AND reason_kind IS NULL AND error IS NULL AND result_version_id IS NULL) OR
      (status = 'running' AND started_at IS NOT NULL AND finished_at IS NULL AND reason_kind IS NULL AND error IS NULL AND result_version_id IS NULL) OR
      (status = 'succeeded' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND reason_kind IS NULL AND error IS NULL AND result_version_id IS NOT NULL) OR
      (status IN ('paused', 'failed', 'cancelled') AND started_at IS NOT NULL AND finished_at IS NOT NULL AND reason_kind IS NOT NULL AND error IS NOT NULL AND result_version_id IS NULL)
    )
);

CREATE INDEX derived_recompute_events_status_idx
ON derived_recompute_events(status, created_at, id);

CREATE INDEX derived_recompute_events_target_idx
ON derived_recompute_events(target_dataset_id, created_at DESC);
`
