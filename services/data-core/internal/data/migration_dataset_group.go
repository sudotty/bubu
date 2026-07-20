package data

const datasetGroupMigrationSQL = `
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
`
