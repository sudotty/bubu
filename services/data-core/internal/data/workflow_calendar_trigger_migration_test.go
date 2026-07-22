package data

import (
	"database/sql"
	"testing"
)

func TestCalendarTriggerMigrationPreservesExistingEvents(t *testing.T) {
	database, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if _, err := database.Exec(`
CREATE TABLE workflow_definitions (id TEXT PRIMARY KEY);
CREATE TABLE workflow_runs (id TEXT PRIMARY KEY);
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
INSERT INTO workflow_definitions(id) VALUES ('workflow-1');
INSERT INTO workflow_trigger_events(
    id, workflow_id, definition_version, operation_id, trigger_kind,
    dedupe_key, due_at, status, created_at
) VALUES ('event-1', 'workflow-1', 1, 'operation-1', 'interval', 'dedupe-1', '2026-07-22T00:00:00Z', 'pending', '2026-07-22T00:00:00Z');
`); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(workflowCalendarTriggerMigrationSQL); err != nil {
		t.Fatal(err)
	}
	var triggerKind string
	if err := database.QueryRow("SELECT trigger_kind FROM workflow_trigger_events WHERE id = 'event-1'").Scan(&triggerKind); err != nil {
		t.Fatal(err)
	}
	if triggerKind != "interval" {
		t.Fatalf("migrated trigger kind = %q, want interval", triggerKind)
	}
	if _, err := database.Exec(`
INSERT INTO workflow_trigger_events(
    id, workflow_id, definition_version, operation_id, trigger_kind,
    dedupe_key, due_at, status, created_at
) VALUES ('event-2', 'workflow-1', 1, 'operation-2', 'calendar', 'dedupe-2', '2026-07-23T00:00:00Z', 'pending', '2026-07-22T00:00:00Z')
`); err != nil {
		t.Fatalf("calendar event rejected after migration: %v", err)
	}
}
