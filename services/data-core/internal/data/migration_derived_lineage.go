package data

const derivedDatasetLineageMigrationSQL = `
CREATE TABLE derived_dataset_lineages (
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_id TEXT PRIMARY KEY REFERENCES dataset_versions(id) ON DELETE CASCADE,
    transformation_kind TEXT NOT NULL CHECK (transformation_kind IN ('dataset-query', 'group-query')),
    purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 500),
    plan_json TEXT NOT NULL CHECK (length(plan_json) BETWEEN 2 AND 100000),
    plan_fingerprint TEXT NOT NULL CHECK (length(plan_fingerprint) = 64),
    created_at TEXT NOT NULL
);

CREATE INDEX derived_dataset_lineages_dataset_idx
ON derived_dataset_lineages(dataset_id, created_at DESC);

CREATE TABLE derived_dataset_lineage_parents (
    derived_version_id TEXT NOT NULL REFERENCES derived_dataset_lineages(version_id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
    parent_dataset_id TEXT NOT NULL CHECK (length(parent_dataset_id) = 32),
    parent_version_id TEXT NOT NULL CHECK (length(parent_version_id) = 32),
    parent_display_name TEXT NOT NULL CHECK (length(parent_display_name) BETWEEN 1 AND 100),
    PRIMARY KEY (derived_version_id, ordinal)
);
`
