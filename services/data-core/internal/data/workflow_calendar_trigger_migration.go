package data

const workflowCalendarTriggerMigrationSQL = `
ALTER TABLE workflow_trigger_events RENAME TO workflow_trigger_events_before_calendar;

CREATE TABLE workflow_trigger_events (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id),
    definition_version INTEGER NOT NULL CHECK (definition_version > 0),
    operation_id TEXT NOT NULL UNIQUE,
    trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('interval', 'calendar', 'dataset-version')),
    dedupe_key TEXT NOT NULL,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    run_id TEXT REFERENCES workflow_runs(id),
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (workflow_id, dedupe_key)
);

INSERT INTO workflow_trigger_events(
    id, workflow_id, definition_version, operation_id, trigger_kind,
    dedupe_key, due_at, status, run_id, error, created_at, finished_at
)
SELECT id, workflow_id, definition_version, operation_id, trigger_kind,
       dedupe_key, due_at, status, run_id, error, created_at, finished_at
FROM workflow_trigger_events_before_calendar;

DROP TABLE workflow_trigger_events_before_calendar;

CREATE INDEX workflow_trigger_events_status_idx
ON workflow_trigger_events(status, due_at, id);
`
