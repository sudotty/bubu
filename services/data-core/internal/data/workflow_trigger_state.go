package data

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type workflowTargetQuery interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func initialWorkflowTriggerState(
	ctx context.Context,
	query workflowTargetQuery,
	target WorkflowTarget,
	trigger WorkflowTrigger,
	now time.Time,
) (string, *string, string, error) {
	encoded, err := json.Marshal(trigger)
	if err != nil {
		return "", nil, "", fmt.Errorf("encode workflow trigger: %w", err)
	}
	if trigger.Kind == "manual" {
		return string(encoded), nil, "", nil
	}
	if trigger.Kind == "interval" {
		next := now.Add(time.Duration(trigger.EveryMinutes) * time.Minute).UTC().Format(time.RFC3339Nano)
		return string(encoded), &next, "", nil
	}
	signature, err := currentWorkflowTargetSignature(ctx, query, target)
	return string(encoded), nil, signature, err
}

func decodeWorkflowTrigger(raw string) (WorkflowTrigger, error) {
	if len(raw) > 1_024 {
		return WorkflowTrigger{}, errors.New("stored workflow trigger exceeds its budget")
	}
	var trigger WorkflowTrigger
	if err := decodeStrictWorkflowJSON([]byte(raw), &trigger); err != nil {
		return WorkflowTrigger{}, errors.New("stored workflow trigger is invalid")
	}
	return trigger, nil
}

func currentWorkflowTargetSignature(
	ctx context.Context,
	query workflowTargetQuery,
	target WorkflowTarget,
) (string, error) {
	hash := sha256.New()
	_, _ = hash.Write([]byte(target.Kind + ":" + target.ID + "\n"))
	if target.Kind == "dataset" {
		var versionID string
		if err := query.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id = ?", target.ID).Scan(&versionID); err != nil {
			return "", errors.New("workflow dataset target is unavailable")
		}
		_, _ = hash.Write([]byte(versionID))
		return hex.EncodeToString(hash.Sum(nil)), nil
	}
	rows, err := query.QueryContext(ctx, `
SELECT members.dataset_id, datasets.current_version_id
FROM dataset_group_members members
JOIN datasets ON datasets.id = members.dataset_id
WHERE members.group_id = ? ORDER BY members.ordinal`, target.ID)
	if err != nil {
		return "", fmt.Errorf("load workflow group signature: %w", err)
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var datasetID, versionID string
		if err := rows.Scan(&datasetID, &versionID); err != nil {
			return "", fmt.Errorf("scan workflow group signature: %w", err)
		}
		_, _ = hash.Write([]byte(datasetID + ":" + versionID + "\n"))
		count++
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("iterate workflow group signature: %w", err)
	}
	if count < 2 || count > 8 {
		return "", errors.New("workflow group target is unavailable")
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func newOperationID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate workflow operation identity: %w", err)
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	raw := hex.EncodeToString(value)
	return fmt.Sprintf("%s-%s-%s-%s-%s", raw[:8], raw[8:12], raw[12:16], raw[16:20], raw[20:]), nil
}
