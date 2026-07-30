package data

const derivedExecutionEvidenceMigrationSQL = `
ALTER TABLE derived_dataset_lineages
ADD COLUMN execution_id TEXT NOT NULL DEFAULT '00000000000000000000000000000000'
CHECK (length(execution_id) = 32);

ALTER TABLE derived_dataset_lineages
ADD COLUMN review_kind TEXT NOT NULL DEFAULT 'reviewed-plan'
CHECK (review_kind IN ('reviewed-plan', 'one-use-approval', 'reviewed-recompute'));

ALTER TABLE derived_dataset_lineages
ADD COLUMN quality_gate_status TEXT NOT NULL DEFAULT 'not-configured'
CHECK (quality_gate_status = 'not-configured');

ALTER TABLE derived_dataset_lineages
ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'
CHECK (length(warnings_json) BETWEEN 2 AND 20000 AND json_valid(warnings_json));

ALTER TABLE derived_dataset_lineages
ADD COLUMN clean_impact_json TEXT
CHECK (clean_impact_json IS NULL OR (length(clean_impact_json) BETWEEN 2 AND 100000 AND json_valid(clean_impact_json)));
`
