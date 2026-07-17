package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type affectedDatasetGroup struct {
	id          string
	memberCount int
}

func (service *Service) DeleteDataset(
	ctx context.Context,
	datasetID string,
) (DatasetDeletionResult, error) {
	if !objectID.MatchString(datasetID) {
		return DatasetDeletionResult{}, errors.New("dataset id is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DatasetDeletionResult{}, fmt.Errorf("begin dataset deletion: %w", err)
	}
	defer transaction.Rollback()
	tableNames, err := datasetVersionTableNames(ctx, transaction, datasetID)
	if err != nil {
		return DatasetDeletionResult{}, err
	}
	groups, err := affectedGroups(ctx, transaction, datasetID)
	if err != nil {
		return DatasetDeletionResult{}, err
	}
	if _, err := transaction.ExecContext(ctx, "DELETE FROM conversation_threads WHERE target_kind = 'dataset' AND target_id = ?", datasetID); err != nil {
		return DatasetDeletionResult{}, fmt.Errorf("delete dataset conversation: %w", err)
	}
	removedGroupIDs := make([]string, 0)
	for _, group := range groups {
		if group.memberCount > minimumGroupMembers {
			continue
		}
		if _, err := transaction.ExecContext(ctx, "DELETE FROM conversation_threads WHERE target_kind = 'group' AND target_id = ?", group.id); err != nil {
			return DatasetDeletionResult{}, fmt.Errorf("delete affected group conversation: %w", err)
		}
		if _, err := transaction.ExecContext(ctx, "DELETE FROM dataset_groups WHERE id = ?", group.id); err != nil {
			return DatasetDeletionResult{}, fmt.Errorf("delete undersized dataset group: %w", err)
		}
		removedGroupIDs = append(removedGroupIDs, group.id)
	}
	result, err := transaction.ExecContext(ctx, "DELETE FROM datasets WHERE id = ?", datasetID)
	if err != nil {
		return DatasetDeletionResult{}, fmt.Errorf("delete dataset catalog: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return DatasetDeletionResult{}, errors.New("dataset not found")
	}
	updatedGroupIDs := make([]string, 0)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	for _, group := range groups {
		if group.memberCount <= minimumGroupMembers {
			continue
		}
		if _, err := transaction.ExecContext(ctx, "UPDATE dataset_groups SET updated_at = ? WHERE id = ?", now, group.id); err != nil {
			return DatasetDeletionResult{}, fmt.Errorf("update affected dataset group: %w", err)
		}
		updatedGroupIDs = append(updatedGroupIDs, group.id)
	}
	for _, tableName := range tableNames {
		if !internalTableName.MatchString(tableName) {
			return DatasetDeletionResult{}, errors.New("stored table name failed validation")
		}
		if _, err := transaction.ExecContext(ctx, "DROP TABLE "+tableName); err != nil {
			return DatasetDeletionResult{}, fmt.Errorf("drop dataset version table: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return DatasetDeletionResult{}, fmt.Errorf("commit dataset deletion: %w", err)
	}
	return DatasetDeletionResult{
		Status: "deleted", DatasetID: datasetID,
		RemovedGroupIDs: removedGroupIDs, UpdatedGroupIDs: updatedGroupIDs,
	}, nil
}

func datasetVersionTableNames(ctx context.Context, transaction *sql.Tx, datasetID string) ([]string, error) {
	rows, err := transaction.QueryContext(ctx, "SELECT table_name FROM dataset_versions WHERE dataset_id = ? ORDER BY ordinal", datasetID)
	if err != nil {
		return nil, fmt.Errorf("load dataset version tables: %w", err)
	}
	defer rows.Close()
	result := make([]string, 0)
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, fmt.Errorf("scan dataset version table: %w", err)
		}
		result = append(result, tableName)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dataset version tables: %w", err)
	}
	if len(result) == 0 {
		return nil, errors.New("dataset not found")
	}
	return result, nil
}

func affectedGroups(ctx context.Context, transaction *sql.Tx, datasetID string) ([]affectedDatasetGroup, error) {
	rows, err := transaction.QueryContext(ctx, `
SELECT target.group_id, COUNT(all_members.dataset_id)
FROM dataset_group_members target
JOIN dataset_group_members all_members ON all_members.group_id = target.group_id
WHERE target.dataset_id = ?
GROUP BY target.group_id
ORDER BY target.group_id`, datasetID)
	if err != nil {
		return nil, fmt.Errorf("load affected dataset groups: %w", err)
	}
	defer rows.Close()
	result := make([]affectedDatasetGroup, 0)
	for rows.Next() {
		var group affectedDatasetGroup
		if err := rows.Scan(&group.id, &group.memberCount); err != nil {
			return nil, fmt.Errorf("scan affected dataset group: %w", err)
		}
		result = append(result, group)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate affected dataset groups: %w", err)
	}
	return result, nil
}
