package data

const workflowApprovalMigrationSQL = `
ALTER TABLE workflow_step_runs RENAME TO workflow_step_runs_before_approval;
DROP INDEX workflow_step_runs_run_idx;

CREATE TABLE workflow_step_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
    kind TEXT NOT NULL CHECK (kind IN ('dataset-query', 'group-query', 'human-approval')),
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 3),
    resolved_input_json TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (run_id, ordinal, attempt)
);

INSERT INTO workflow_step_runs(
 id, run_id, step_id, ordinal, kind, status, attempt, resolved_input_json,
 result_json, error, started_at, finished_at
)
SELECT id, run_id, step_id, ordinal, kind, status, attempt, resolved_input_json,
       result_json, error, started_at, finished_at
FROM workflow_step_runs_before_approval;

DROP TABLE workflow_step_runs_before_approval;
CREATE INDEX workflow_step_runs_run_idx ON workflow_step_runs(run_id, ordinal, attempt);

CREATE TABLE workflow_approval_requests (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id),
    definition_version INTEGER NOT NULL CHECK (definition_version > 0),
    run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
    target_kind TEXT NOT NULL CHECK (target_kind IN ('dataset', 'group')),
    target_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 500),
    risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    requested_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    decided_at TEXT,
    decision_note TEXT CHECK (decision_note IS NULL OR length(decision_note) BETWEEN 1 AND 500),
    UNIQUE (run_id, ordinal)
);

CREATE INDEX workflow_approval_requests_status_idx
ON workflow_approval_requests(status, expires_at, requested_at, id);
`
