package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	minimumGroupMembers     = 2
	maximumGroupMembers     = 8
	maximumGroupsPerDataset = 100
)

func (service *Service) SaveGroup(
	ctx context.Context,
	groupID string,
	name string,
	description string,
	cadence string,
	datasetIDs []string,
) (DatasetGroup, error) {
	normalizedName := strings.TrimSpace(name)
	if normalizedName == "" || utf8.RuneCountInString(normalizedName) > 100 {
		return DatasetGroup{}, errors.New("group name is invalid")
	}
	normalizedDescription := strings.TrimSpace(description)
	if utf8.RuneCountInString(normalizedDescription) > 240 {
		return DatasetGroup{}, errors.New("group description is invalid")
	}
	if !validGroupCadence(cadence) {
		return DatasetGroup{}, errors.New("group cadence is invalid")
	}
	if len(datasetIDs) < minimumGroupMembers || len(datasetIDs) > maximumGroupMembers {
		return DatasetGroup{}, fmt.Errorf("group must contain between %d and %d datasets", minimumGroupMembers, maximumGroupMembers)
	}
	seen := make(map[string]bool, len(datasetIDs))
	for _, datasetID := range datasetIDs {
		if !objectID.MatchString(datasetID) || seen[datasetID] {
			return DatasetGroup{}, errors.New("group dataset identities are invalid or duplicated")
		}
		seen[datasetID] = true
	}
	creating := groupID == ""
	if creating {
		var err error
		groupID, err = newID()
		if err != nil {
			return DatasetGroup{}, err
		}
	} else if !objectID.MatchString(groupID) {
		return DatasetGroup{}, errors.New("group id is invalid")
	}

	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DatasetGroup{}, fmt.Errorf("begin group save: %w", err)
	}
	defer transaction.Rollback()
	for _, datasetID := range datasetIDs {
		var exists int
		err := transaction.QueryRowContext(ctx, `
SELECT 1
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, datasetID).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return DatasetGroup{}, fmt.Errorf("group dataset %s was not found", datasetID)
		}
		if err != nil {
			return DatasetGroup{}, fmt.Errorf("validate group dataset: %w", err)
		}
		var membershipCount int
		if err := transaction.QueryRowContext(ctx, `
SELECT COUNT(*) FROM dataset_group_members WHERE dataset_id = ? AND group_id <> ?`, datasetID, groupID).Scan(&membershipCount); err != nil {
			return DatasetGroup{}, fmt.Errorf("count dataset group memberships: %w", err)
		}
		if membershipCount >= maximumGroupsPerDataset {
			return DatasetGroup{}, fmt.Errorf("a dataset cannot belong to more than %d groups", maximumGroupsPerDataset)
		}
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if creating {
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_groups(id, name, description, cadence, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`, groupID, normalizedName, normalizedDescription, cadence, now, now); err != nil {
			return DatasetGroup{}, fmt.Errorf("create dataset group: %w", err)
		}
	} else {
		result, err := transaction.ExecContext(ctx, `
UPDATE dataset_groups SET name = ?, description = ?, cadence = ?, updated_at = ? WHERE id = ?`, normalizedName, normalizedDescription, cadence, now, groupID)
		if err != nil {
			return DatasetGroup{}, fmt.Errorf("update dataset group: %w", err)
		}
		if affected, err := result.RowsAffected(); err != nil || affected != 1 {
			return DatasetGroup{}, errors.New("dataset group not found")
		}
		if _, err := transaction.ExecContext(ctx, "DELETE FROM dataset_group_members WHERE group_id = ?", groupID); err != nil {
			return DatasetGroup{}, fmt.Errorf("replace dataset group members: %w", err)
		}
	}
	for ordinal, datasetID := range datasetIDs {
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_group_members(group_id, dataset_id, ordinal) VALUES (?, ?, ?)`, groupID, datasetID, ordinal); err != nil {
			return DatasetGroup{}, fmt.Errorf("add dataset group member: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return DatasetGroup{}, fmt.Errorf("commit dataset group: %w", err)
	}
	return service.GetGroup(ctx, groupID)
}

func (service *Service) ListGroups(ctx context.Context) ([]DatasetGroup, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT id, name, description, cadence, created_at, updated_at
FROM dataset_groups
ORDER BY updated_at DESC, id`)
	if err != nil {
		return nil, fmt.Errorf("list dataset groups: %w", err)
	}
	defer rows.Close()
	groups := make([]DatasetGroup, 0)
	for rows.Next() {
		var group DatasetGroup
		if err := rows.Scan(&group.ID, &group.Name, &group.Description, &group.Cadence, &group.CreatedAt, &group.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan dataset group: %w", err)
		}
		groups = append(groups, group)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dataset groups: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close dataset group rows: %w", err)
	}
	for index := range groups {
		members, err := service.loadGroupMembers(ctx, groups[index].ID)
		if err != nil {
			return nil, err
		}
		groups[index].Members = members
	}
	return groups, nil
}

func (service *Service) GetGroup(ctx context.Context, groupID string) (DatasetGroup, error) {
	if !objectID.MatchString(groupID) {
		return DatasetGroup{}, errors.New("group id is invalid")
	}
	var group DatasetGroup
	err := service.database.QueryRowContext(ctx, `
SELECT id, name, description, cadence, created_at, updated_at FROM dataset_groups WHERE id = ?`, groupID).Scan(
		&group.ID, &group.Name, &group.Description, &group.Cadence, &group.CreatedAt, &group.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return DatasetGroup{}, errors.New("dataset group not found")
	}
	if err != nil {
		return DatasetGroup{}, fmt.Errorf("load dataset group: %w", err)
	}
	group.Members, err = service.loadGroupMembers(ctx, groupID)
	return group, err
}

func validGroupCadence(value string) bool {
	switch value {
	case "one-off", "daily", "weekly", "monthly", "dataset-version":
		return true
	default:
		return false
	}
}

func (service *Service) loadGroupMembers(ctx context.Context, groupID string) ([]DatasetSummary, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT d.id, v.id, d.display_name, d.source_kind, d.source_name,
       v.row_count, v.column_count, v.imported_at, v.ordinal
FROM dataset_group_members gm
JOIN datasets d ON d.id = gm.dataset_id
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE gm.group_id = ? AND v.status = 'ready'
ORDER BY gm.ordinal`, groupID)
	if err != nil {
		return nil, fmt.Errorf("load dataset group members: %w", err)
	}
	defer rows.Close()
	members := make([]DatasetSummary, 0)
	for rows.Next() {
		var dataset DatasetSummary
		if err := rows.Scan(
			&dataset.ID, &dataset.VersionID, &dataset.DisplayName, &dataset.SourceKind,
			&dataset.SourceName, &dataset.RowCount, &dataset.ColumnCount,
			&dataset.ImportedAt, &dataset.Version,
		); err != nil {
			return nil, fmt.Errorf("scan dataset group member: %w", err)
		}
		members = append(members, dataset)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dataset group members: %w", err)
	}
	return members, nil
}

func (service *Service) DeleteGroup(ctx context.Context, groupID string) error {
	if !objectID.MatchString(groupID) {
		return errors.New("group id is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin dataset group deletion: %w", err)
	}
	defer transaction.Rollback()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if err := retireTargetWorkflows(ctx, transaction, WorkflowTarget{Kind: "group", ID: groupID}, now); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(ctx, "DELETE FROM conversation_threads WHERE target_kind = 'group' AND target_id = ?", groupID); err != nil {
		return fmt.Errorf("delete dataset group conversation: %w", err)
	}
	result, err := transaction.ExecContext(ctx, "DELETE FROM dataset_groups WHERE id = ?", groupID)
	if err != nil {
		return fmt.Errorf("delete dataset group: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted dataset group count: %w", err)
	}
	if affected != 1 {
		return errors.New("dataset group not found")
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit dataset group deletion: %w", err)
	}
	return nil
}
