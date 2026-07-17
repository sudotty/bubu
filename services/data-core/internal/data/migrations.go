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
