package data

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const maximumRelationshipCandidates = 500

func (service *Service) SaveRelationship(
	ctx context.Context,
	input DatasetRelationshipSaveInput,
) (DatasetRelationship, error) {
	if err := validateRelationshipInput(input); err != nil {
		return DatasetRelationship{}, err
	}
	left, err := service.loadQualityTarget(ctx, input.Left.DatasetID)
	if err != nil {
		return DatasetRelationship{}, err
	}
	right, err := service.loadQualityTarget(ctx, input.Right.DatasetID)
	if err != nil {
		return DatasetRelationship{}, err
	}
	issue := relationshipIssue(input, left, right)
	if issue != nil {
		return DatasetRelationship{}, fmt.Errorf("relationship is not currently valid: %s", *issue)
	}
	id, err := newID()
	if err != nil {
		return DatasetRelationship{}, err
	}
	createdAt := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = service.database.ExecContext(ctx, `
INSERT INTO dataset_relationships(
    id, kind, left_dataset_id, left_column, right_dataset_id, right_column, created_at
) VALUES (?, 'lookup', ?, ?, ?, ?, ?)`,
		id, input.Left.DatasetID, input.Left.Column, input.Right.DatasetID, input.Right.Column, createdAt,
	)
	if err != nil {
		return DatasetRelationship{}, fmt.Errorf("store dataset relationship: %w", err)
	}
	return DatasetRelationship{
		ID: id, Kind: "lookup", Left: input.Left, Right: input.Right,
		Status: "ready", CreatedAt: createdAt,
	}, nil
}

func (service *Service) DeleteRelationship(ctx context.Context, relationshipID string) error {
	if !objectID.MatchString(relationshipID) {
		return errors.New("relationship id is invalid")
	}
	result, err := service.database.ExecContext(ctx, "DELETE FROM dataset_relationships WHERE id = ?", relationshipID)
	if err != nil {
		return fmt.Errorf("delete dataset relationship: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read deleted relationship count: %w", err)
	}
	if affected != 1 {
		return errors.New("dataset relationship not found")
	}
	return nil
}

func (service *Service) GetGroupRelationships(
	ctx context.Context,
	groupID string,
) (GroupRelationshipOverview, error) {
	group, err := service.GetGroup(ctx, groupID)
	if err != nil {
		return GroupRelationshipOverview{}, err
	}
	targets := make(map[string]qualityTarget, len(group.Members))
	for _, member := range group.Members {
		target, err := service.loadQualityTarget(ctx, member.ID)
		if err != nil {
			return GroupRelationshipOverview{}, err
		}
		targets[member.ID] = target
	}
	relationships, err := service.loadGroupRelationships(ctx, groupID, targets)
	if err != nil {
		return GroupRelationshipOverview{}, err
	}
	saved := make(map[string]struct{}, len(relationships))
	for _, relationship := range relationships {
		saved[relationshipKey(relationship.Left, relationship.Right)] = struct{}{}
	}
	candidates := discoverRelationshipCandidates(group, targets, saved)
	return GroupRelationshipOverview{
		GroupID: groupID, Relationships: relationships, Candidates: candidates,
	}, nil
}

func (service *Service) loadGroupRelationships(
	ctx context.Context,
	groupID string,
	targets map[string]qualityTarget,
) ([]DatasetRelationship, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT r.id, r.kind, r.left_dataset_id, r.left_column,
       r.right_dataset_id, r.right_column, r.created_at
FROM dataset_relationships r
JOIN dataset_group_members left_member
  ON left_member.group_id = ? AND left_member.dataset_id = r.left_dataset_id
JOIN dataset_group_members right_member
  ON right_member.group_id = ? AND right_member.dataset_id = r.right_dataset_id
ORDER BY r.created_at, r.id`, groupID, groupID)
	if err != nil {
		return nil, fmt.Errorf("load group relationships: %w", err)
	}
	defer rows.Close()
	result := make([]DatasetRelationship, 0)
	for rows.Next() {
		var relationship DatasetRelationship
		if err := rows.Scan(
			&relationship.ID, &relationship.Kind,
			&relationship.Left.DatasetID, &relationship.Left.Column,
			&relationship.Right.DatasetID, &relationship.Right.Column,
			&relationship.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan group relationship: %w", err)
		}
		issue := relationshipIssue(
			DatasetRelationshipSaveInput{Left: relationship.Left, Right: relationship.Right},
			targets[relationship.Left.DatasetID],
			targets[relationship.Right.DatasetID],
		)
		relationship.Issue = issue
		if issue == nil {
			relationship.Status = "ready"
		} else {
			relationship.Status = "invalid"
		}
		result = append(result, relationship)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group relationships: %w", err)
	}
	return result, nil
}

func validateRelationshipInput(input DatasetRelationshipSaveInput) error {
	if !objectID.MatchString(input.Left.DatasetID) || !objectID.MatchString(input.Right.DatasetID) {
		return errors.New("relationship dataset identities are invalid")
	}
	if input.Left.DatasetID == input.Right.DatasetID {
		return errors.New("relationship needs two different datasets")
	}
	if strings.TrimSpace(input.Left.Column) == "" || len(input.Left.Column) > 500 ||
		strings.TrimSpace(input.Right.Column) == "" || len(input.Right.Column) > 500 {
		return errors.New("relationship columns are invalid")
	}
	return nil
}
