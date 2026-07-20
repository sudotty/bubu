package data

const datasetVersionSourceNameMigrationSQL = `
ALTER TABLE dataset_versions ADD COLUMN source_name TEXT NOT NULL DEFAULT '';
UPDATE dataset_versions
SET source_name = (
    SELECT datasets.source_name
    FROM datasets
    WHERE datasets.id = dataset_versions.dataset_id
);
`
