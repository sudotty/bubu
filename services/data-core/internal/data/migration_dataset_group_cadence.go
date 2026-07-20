package data

const datasetGroupCadenceMigrationSQL = `
ALTER TABLE dataset_groups ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE dataset_groups ADD COLUMN cadence TEXT NOT NULL DEFAULT 'one-off'
CHECK (cadence IN ('one-off', 'daily', 'weekly', 'monthly', 'dataset-version'));
`
