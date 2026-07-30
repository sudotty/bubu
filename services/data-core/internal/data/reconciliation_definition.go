package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type ReconciliationDefinition struct {
	SchemaVersion   int                `json:"schemaVersion"`
	ID              string             `json:"id"`
	Plan            ReconciliationPlan `json:"plan"`
	PlanFingerprint string             `json:"planFingerprint"`
	Active          bool               `json:"active"`
	LastArtifactID  string             `json:"lastArtifactId"`
	CreatedAt       string             `json:"createdAt"`
	UpdatedAt       string             `json:"updatedAt"`
}
type ReconciliationReplayEvent struct {
	SchemaVersion    int     `json:"schemaVersion"`
	ID               string  `json:"id"`
	DefinitionID     string  `json:"definitionId"`
	TriggerDatasetID string  `json:"triggerDatasetId"`
	TriggerVersionID string  `json:"triggerVersionId"`
	SourceSignature  string  `json:"-"`
	Status           string  `json:"status"`
	ReasonKind       *string `json:"reasonKind"`
	Error            *string `json:"error"`
	ArtifactID       *string `json:"artifactId"`
	Attempt          int     `json:"attempt"`
	CreatedAt        string  `json:"createdAt"`
	StartedAt        *string `json:"startedAt"`
	FinishedAt       *string `json:"finishedAt"`
}

func (service *Service) SaveReconciliationDefinition(ctx context.Context, artifactID string) (ReconciliationDefinition, error) {
	artifact, err := service.GetReconciliationArtifact(ctx, artifactID)
	if err != nil {
		return ReconciliationDefinition{}, err
	}
	rawPlan, fingerprint, err := reconciliationPlanEvidence(artifact.Plan)
	if err != nil {
		return ReconciliationDefinition{}, err
	}
	rawBaseline, err := json.Marshal(artifact.ReconciliationPreview)
	if err != nil {
		return ReconciliationDefinition{}, err
	}
	var existingID string
	if err := service.database.QueryRowContext(ctx, "SELECT id FROM reconciliation_definitions WHERE plan_fingerprint = ? AND active = 1", fingerprint).Scan(&existingID); err == nil {
		return service.getReconciliationDefinition(ctx, existingID)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return ReconciliationDefinition{}, err
	}
	id, err := newID()
	if err != nil {
		return ReconciliationDefinition{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := service.database.ExecContext(ctx, `INSERT INTO reconciliation_definitions(id, plan_json, plan_fingerprint, left_dataset_id, right_dataset_id, baseline_preview_json, last_artifact_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, id, string(rawPlan), fingerprint, artifact.Plan.Comparison.Sources.Left.DatasetID, artifact.Plan.Comparison.Sources.Right.DatasetID, string(rawBaseline), artifactID, now, now); err != nil {
		return ReconciliationDefinition{}, fmt.Errorf("save reconciliation definition: %w", err)
	}
	return service.getReconciliationDefinition(ctx, id)
}

func (service *Service) getReconciliationDefinition(ctx context.Context, id string) (ReconciliationDefinition, error) {
	var value ReconciliationDefinition
	var rawPlan string
	var active int
	value.SchemaVersion, value.ID = 1, id
	if err := service.database.QueryRowContext(ctx, `SELECT plan_json, plan_fingerprint, active, last_artifact_id, created_at, updated_at FROM reconciliation_definitions WHERE id = ?`, id).Scan(&rawPlan, &value.PlanFingerprint, &active, &value.LastArtifactID, &value.CreatedAt, &value.UpdatedAt); err != nil {
		return ReconciliationDefinition{}, err
	}
	if json.Unmarshal([]byte(rawPlan), &value.Plan) != nil {
		return ReconciliationDefinition{}, errors.New("stored reconciliation definition is invalid")
	}
	value.Active = active == 1
	return value, nil
}

func (service *Service) ListReconciliationArtifacts(ctx context.Context, datasetIDs []string) ([]ReconciliationArtifact, error) {
	if len(datasetIDs) < 1 || len(datasetIDs) > 8 {
		return nil, errors.New("artifact dataset filter is invalid")
	}
	arguments := make([]any, 0, len(datasetIDs)*2)
	placeholders := make([]string, len(datasetIDs))
	for index, id := range datasetIDs {
		if !objectID.MatchString(id) {
			return nil, errors.New("artifact dataset filter is invalid")
		}
		placeholders[index] = "?"
		arguments = append(arguments, id)
	}
	arguments = append(arguments, arguments...)
	query := `SELECT result_json FROM reconciliation_artifacts WHERE left_dataset_id IN (` + strings.Join(placeholders, ",") + `) OR right_dataset_id IN (` + strings.Join(placeholders, ",") + `) ORDER BY created_at DESC, id DESC LIMIT 20`
	rows, err := service.database.QueryContext(ctx, query, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ReconciliationArtifact{}
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var artifact ReconciliationArtifact
		if json.Unmarshal([]byte(raw), &artifact) != nil {
			return nil, errors.New("stored reconciliation artifact is invalid")
		}
		result = append(result, artifact)
	}
	return result, rows.Err()
}
