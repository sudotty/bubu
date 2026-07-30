package data

const dataCleanQualityMigrationSQL = `
ALTER TABLE derived_dataset_lineage_parents RENAME TO derived_dataset_lineage_parents_v21;
ALTER TABLE derived_dataset_lineages RENAME TO derived_dataset_lineages_v21;

CREATE TABLE derived_dataset_lineages (
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_id TEXT PRIMARY KEY REFERENCES dataset_versions(id) ON DELETE CASCADE,
    transformation_kind TEXT NOT NULL CHECK (transformation_kind IN ('dataset-query', 'group-query', 'data-clean')),
    purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 500),
    plan_json TEXT NOT NULL CHECK (length(plan_json) BETWEEN 2 AND 100000),
    plan_fingerprint TEXT NOT NULL CHECK (length(plan_fingerprint) = 64),
    execution_id TEXT NOT NULL CHECK (length(execution_id) = 32),
    review_kind TEXT NOT NULL CHECK (review_kind IN ('reviewed-plan', 'one-use-approval', 'reviewed-recompute')),
    quality_gate_status TEXT NOT NULL CHECK (quality_gate_status IN ('not-configured', 'passed', 'warning')),
    warnings_json TEXT NOT NULL CHECK (length(warnings_json) BETWEEN 2 AND 20000 AND json_valid(warnings_json)),
    clean_impact_json TEXT CHECK (clean_impact_json IS NULL OR (length(clean_impact_json) BETWEEN 2 AND 100000 AND json_valid(clean_impact_json))),
    quality_policy_json TEXT CHECK (quality_policy_json IS NULL OR (length(quality_policy_json) BETWEEN 2 AND 100000 AND json_valid(quality_policy_json))),
    quality_evidence_json TEXT CHECK (quality_evidence_json IS NULL OR (length(quality_evidence_json) BETWEEN 2 AND 100000 AND json_valid(quality_evidence_json))),
    created_at TEXT NOT NULL,
    CHECK ((quality_gate_status = 'not-configured' AND quality_policy_json IS NULL AND quality_evidence_json IS NULL) OR (quality_gate_status IN ('passed', 'warning') AND quality_policy_json IS NOT NULL AND quality_evidence_json IS NOT NULL))
);

CREATE TABLE derived_dataset_lineage_parents (
    derived_version_id TEXT NOT NULL REFERENCES derived_dataset_lineages(version_id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
    parent_dataset_id TEXT NOT NULL CHECK (length(parent_dataset_id) = 32),
    parent_version_id TEXT NOT NULL CHECK (length(parent_version_id) = 32),
    parent_display_name TEXT NOT NULL CHECK (length(parent_display_name) BETWEEN 1 AND 100),
    PRIMARY KEY (derived_version_id, ordinal)
);

INSERT INTO derived_dataset_lineages(
    dataset_id, version_id, transformation_kind, purpose, plan_json,
    plan_fingerprint, execution_id, review_kind, quality_gate_status,
    warnings_json, clean_impact_json, quality_policy_json, quality_evidence_json, created_at
)
SELECT dataset_id, version_id, transformation_kind, purpose, plan_json,
       plan_fingerprint, execution_id, review_kind, quality_gate_status,
       warnings_json, clean_impact_json, NULL, NULL, created_at
FROM derived_dataset_lineages_v21;

INSERT INTO derived_dataset_lineage_parents(
    derived_version_id, ordinal, parent_dataset_id, parent_version_id, parent_display_name
)
SELECT derived_version_id, ordinal, parent_dataset_id, parent_version_id, parent_display_name
FROM derived_dataset_lineage_parents_v21;

DROP TABLE derived_dataset_lineage_parents_v21;
DROP TABLE derived_dataset_lineages_v21;

CREATE INDEX derived_dataset_lineages_dataset_idx
ON derived_dataset_lineages(dataset_id, created_at DESC);

CREATE TABLE data_clean_quality_attempts (
    execution_id TEXT PRIMARY KEY CHECK (length(execution_id) = 32),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
    plan_json TEXT NOT NULL CHECK (length(plan_json) BETWEEN 2 AND 100000 AND json_valid(plan_json)),
    plan_fingerprint TEXT NOT NULL CHECK (length(plan_fingerprint) = 64),
    quality_policy_json TEXT NOT NULL CHECK (length(quality_policy_json) BETWEEN 2 AND 100000 AND json_valid(quality_policy_json)),
    quality_evidence_json TEXT NOT NULL CHECK (length(quality_evidence_json) BETWEEN 2 AND 100000 AND json_valid(quality_evidence_json)),
    status TEXT NOT NULL CHECK (status = 'blocked'),
    created_at TEXT NOT NULL
);

CREATE INDEX data_clean_quality_attempts_created_idx
ON data_clean_quality_attempts(created_at DESC);
`
