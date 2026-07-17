package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func validateBackupDatabase(
	ctx context.Context,
	path string,
	manifest backupManifest,
) error {
	database, err := openReadOnlyBackupDatabase(path)
	if err != nil {
		return err
	}
	defer database.Close()
	if _, err := database.ExecContext(ctx, "PRAGMA query_only = ON"); err != nil {
		return fmt.Errorf("protect backup validation connection: %w", err)
	}
	var integrity string
	if err := database.QueryRowContext(ctx, "PRAGMA integrity_check").Scan(&integrity); err != nil {
		return fmt.Errorf("check backup database integrity: %w", err)
	}
	if integrity != "ok" {
		return fmt.Errorf("backup database integrity failed: %s", integrity)
	}
	if err := validateBackupMigrations(ctx, database, manifest.SchemaVersion); err != nil {
		return err
	}
	if err := validateBackupSchemaObjects(ctx, database, manifest.SchemaVersion); err != nil {
		return err
	}
	if err := validateBackupDataInvariants(ctx, database, manifest); err != nil {
		return err
	}
	rows, err := database.QueryContext(ctx, "PRAGMA foreign_key_check")
	if err != nil {
		return fmt.Errorf("check backup foreign keys: %w", err)
	}
	defer rows.Close()
	if rows.Next() {
		return errors.New("backup contains invalid foreign-key references")
	}
	return rows.Err()
}

func openReadOnlyBackupDatabase(path string) (*sql.DB, error) {
	location := &url.URL{Scheme: "file", Path: path, RawQuery: "mode=ro&immutable=1"}
	database, err := sql.Open("sqlite", location.String())
	if err != nil {
		return nil, fmt.Errorf("open backup database read-only: %w", err)
	}
	database.SetMaxOpenConns(1)
	return database, nil
}

func validateBackupMigrations(ctx context.Context, database *sql.DB, expected int) error {
	var count, minimum, maximum int
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*), COALESCE(MIN(version), 0), COALESCE(MAX(version), 0)
FROM schema_migrations`).Scan(&count, &minimum, &maximum); err != nil {
		return fmt.Errorf("read backup migrations: %w", err)
	}
	if expected < 1 || expected > len(migrations) || count != expected || minimum != 1 || maximum != expected {
		return errors.New("backup migration history is incomplete or unsupported")
	}
	return nil
}

func validateBackupSchemaObjects(ctx context.Context, database *sql.DB, schemaVersion int) error {
	allowedTables, allowedIndexes := backupSchemaObjects(schemaVersion)
	expectedDynamic, err := backupVersionTables(ctx, database)
	if err != nil {
		return err
	}
	actualDynamic := make(map[string]bool, len(expectedDynamic))
	rows, err := database.QueryContext(ctx, `
SELECT type, name
FROM sqlite_master
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name`)
	if err != nil {
		return fmt.Errorf("inspect backup schema objects: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var objectType, name string
		if err := rows.Scan(&objectType, &name); err != nil {
			return fmt.Errorf("scan backup schema object: %w", err)
		}
		switch objectType {
		case "table":
			if internalTableName.MatchString(name) {
				actualDynamic[name] = true
				continue
			}
			if !allowedTables[name] {
				return fmt.Errorf("backup contains an unexpected table: %s", name)
			}
		case "index":
			if !allowedIndexes[name] {
				return fmt.Errorf("backup contains an unexpected index: %s", name)
			}
		default:
			return fmt.Errorf("backup contains forbidden %s object: %s", objectType, name)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate backup schema objects: %w", err)
	}
	if len(actualDynamic) != len(expectedDynamic) {
		return errors.New("backup physical tables do not match version metadata")
	}
	for name := range expectedDynamic {
		if !actualDynamic[name] {
			return fmt.Errorf("backup is missing physical version table: %s", name)
		}
	}
	return nil
}

func backupSchemaObjects(schemaVersion int) (map[string]bool, map[string]bool) {
	tables := map[string]bool{
		"schema_migrations": true, "datasets": true,
		"dataset_versions": true, "dataset_columns": true,
	}
	indexes := map[string]bool{
		"dataset_versions_dataset_id_idx": true,
		"dataset_columns_version_id_idx":  true,
	}
	if schemaVersion >= 3 {
		tables["dataset_groups"] = true
		tables["dataset_group_members"] = true
		indexes["dataset_group_members_dataset_id_idx"] = true
	}
	if schemaVersion >= 4 {
		tables["conversation_threads"] = true
		tables["conversation_entries"] = true
		indexes["conversation_entries_thread_id_idx"] = true
	}
	if schemaVersion >= 5 {
		tables["dataset_validation_rules"] = true
	}
	if schemaVersion >= 6 {
		tables["dataset_relationships"] = true
		indexes["dataset_relationships_left_dataset_idx"] = true
		indexes["dataset_relationships_right_dataset_idx"] = true
	}
	if schemaVersion >= 7 {
		tables["workflow_definitions"] = true
		tables["workflow_runs"] = true
		tables["workflow_step_runs"] = true
		indexes["workflow_definitions_target_idx"] = true
		indexes["workflow_runs_workflow_idx"] = true
		indexes["workflow_step_runs_run_idx"] = true
	}
	if schemaVersion >= 8 {
		tables["model_disclosure_events"] = true
		tables["model_disclosure_outcomes"] = true
		indexes["model_disclosure_events_started_idx"] = true
	}
	if schemaVersion >= 9 {
		tables["workflow_trigger_events"] = true
		indexes["workflow_trigger_events_status_idx"] = true
	}
	return tables, indexes
}

func backupVersionTables(ctx context.Context, database *sql.DB) (map[string]bool, error) {
	rows, err := database.QueryContext(ctx, "SELECT table_name FROM dataset_versions WHERE status = 'ready'")
	if err != nil {
		return nil, fmt.Errorf("read backup version tables: %w", err)
	}
	defer rows.Close()
	result := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan backup version table: %w", err)
		}
		if !internalTableName.MatchString(name) || result[name] {
			return nil, errors.New("backup contains invalid or duplicate physical table metadata")
		}
		result[name] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate backup version tables: %w", err)
	}
	var nonReady int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM dataset_versions WHERE status <> 'ready'").Scan(&nonReady); err != nil || nonReady != 0 {
		return nil, errors.New("backup contains incomplete dataset versions")
	}
	return result, nil
}

func validateBackupDataInvariants(ctx context.Context, database *sql.DB, manifest backupManifest) error {
	var datasetCount, groupCount int64
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM datasets").Scan(&datasetCount); err != nil {
		return fmt.Errorf("count restored datasets: %w", err)
	}
	if manifest.SchemaVersion >= 3 {
		if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM dataset_groups").Scan(&groupCount); err != nil {
			return fmt.Errorf("count restored groups: %w", err)
		}
		var invalidGroups int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT groups.id
  FROM dataset_groups groups
  LEFT JOIN dataset_group_members members ON members.group_id = groups.id
  GROUP BY groups.id
  HAVING COUNT(members.dataset_id) < 2 OR COUNT(members.dataset_id) > 8
)`).Scan(&invalidGroups); err != nil || invalidGroups != 0 {
			return errors.New("backup contains invalid dataset-group membership")
		}
		var excessiveMemberships int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT dataset_id FROM dataset_group_members GROUP BY dataset_id HAVING COUNT(*) > ?
)`, maximumGroupsPerDataset).Scan(&excessiveMemberships); err != nil || excessiveMemberships != 0 {
			return errors.New("backup exceeds the bounded groups-per-dataset policy")
		}
	}
	if datasetCount != manifest.DatasetCount || groupCount != manifest.GroupCount {
		return errors.New("backup manifest counts do not match its database")
	}
	if manifest.SchemaVersion >= 2 {
		var storedLocators int
		if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM datasets WHERE source_locator <> ''").Scan(&storedLocators); err != nil || storedLocators != 0 {
			return errors.New("backup contains forbidden persisted source paths")
		}
	}
	if manifest.SchemaVersion >= 4 {
		var oversized int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM conversation_entries WHERE length(payload_json) > ?`, maximumConversationPayload).Scan(&oversized); err != nil || oversized != 0 {
			return errors.New("backup contains oversized conversation artifacts")
		}
		var excessiveThreads int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT thread_id FROM conversation_entries GROUP BY thread_id HAVING COUNT(*) > ?
)`, maximumConversationEntries).Scan(&excessiveThreads); err != nil || excessiveThreads != 0 {
			return errors.New("backup contains oversized conversation histories")
		}
	}
	if manifest.SchemaVersion >= 7 {
		var excessiveDefinitions int
		if err := database.QueryRowContext(ctx, `
SELECT CASE WHEN COUNT(*) > ? THEN 1 ELSE 0 END FROM workflow_definitions WHERE deleted_at IS NULL`, maximumWorkflowDefinitions).Scan(&excessiveDefinitions); err != nil || excessiveDefinitions != 0 {
			return errors.New("backup exceeds the active-workflow limit")
		}
		var invalidWorkflowPayloads int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM workflow_definitions
WHERE length(steps_json) > ? OR timeout_ms < 1000 OR timeout_ms > 600000`, maximumWorkflowJSONBytes).Scan(&invalidWorkflowPayloads); err != nil || invalidWorkflowPayloads != 0 {
			return errors.New("backup contains invalid workflow definitions")
		}
		var invalidRunPayloads int
		if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM workflow_step_runs
WHERE length(resolved_input_json) > ? OR length(COALESCE(result_json, '')) > ?`, maximumWorkflowJSONBytes, maximumWorkflowJSONBytes).Scan(&invalidRunPayloads); err != nil || invalidRunPayloads != 0 {
			return errors.New("backup contains oversized workflow checkpoints")
		}
		if err := validateBackupWorkflows(ctx, database, manifest.SchemaVersion); err != nil {
			return err
		}
	}
	if manifest.SchemaVersion >= 8 {
		if err := validateBackupModelAudits(ctx, database); err != nil {
			return err
		}
	}
	return nil
}

func validBackupDigest(value string) bool {
	return len(value) == sha256HexLength && strings.Trim(value, "0123456789abcdef") == ""
}

const sha256HexLength = 64
