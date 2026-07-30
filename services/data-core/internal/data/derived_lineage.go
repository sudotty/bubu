package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

func (service *Service) GetDerivedDatasetLineage(ctx context.Context, datasetID string) (*DerivedDatasetLineage, error) {
	if !objectID.MatchString(datasetID) {
		return nil, errors.New("dataset id is invalid")
	}
	var lineage DerivedDatasetLineage
	var warningsJSON string
	var cleanImpactJSON, qualityEvidenceJSON sql.NullString
	err := service.database.QueryRowContext(ctx, `
SELECT l.dataset_id, l.version_id, l.transformation_kind, l.purpose,
       l.plan_fingerprint, l.execution_id, l.review_kind, l.quality_gate_status,
       l.warnings_json, l.clean_impact_json, l.quality_evidence_json, l.created_at
FROM datasets d JOIN derived_dataset_lineages l ON l.version_id = d.current_version_id
WHERE d.id = ? AND d.source_kind = 'derived'`, datasetID).Scan(
		&lineage.DatasetID, &lineage.VersionID, &lineage.TransformationKind, &lineage.Purpose,
		&lineage.PlanFingerprint, &lineage.ExecutionEvidence.ExecutionID, &lineage.ExecutionEvidence.ReviewKind,
		&lineage.ExecutionEvidence.QualityGateStatus, &warningsJSON, &cleanImpactJSON, &qualityEvidenceJSON, &lineage.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load derived dataset lineage: %w", err)
	}
	if err := json.Unmarshal([]byte(warningsJSON), &lineage.ExecutionEvidence.Warnings); err != nil || lineage.ExecutionEvidence.Warnings == nil || len(lineage.ExecutionEvidence.Warnings) > 40 {
		return nil, errors.New("derived execution warnings are invalid")
	}
	if cleanImpactJSON.Valid {
		var impact DataCleanImpactPreview
		if err := json.Unmarshal([]byte(cleanImpactJSON.String), &impact); err != nil {
			return nil, fmt.Errorf("decode data-clean execution impact: %w", err)
		}
		lineage.ExecutionEvidence.CleanImpact = &impact
	}
	if qualityEvidenceJSON.Valid {
		var quality DataCleanQualityEvidence
		if err := json.Unmarshal([]byte(qualityEvidenceJSON.String), &quality); err != nil {
			return nil, fmt.Errorf("decode data-clean quality evidence: %w", err)
		}
		lineage.ExecutionEvidence.Quality = &quality
	}
	legacyCleanEvidence := lineage.TransformationKind == "data-clean" && lineage.ExecutionEvidence.CleanImpact == nil && lineage.ExecutionEvidence.ReviewKind == "reviewed-plan"
	qualityStatus := lineage.ExecutionEvidence.QualityGateStatus
	qualityConsistent := qualityStatus == "not-configured" && lineage.ExecutionEvidence.Quality == nil || oneOf(qualityStatus, "passed", "warning") && lineage.ExecutionEvidence.Quality != nil && lineage.ExecutionEvidence.Quality.Status == qualityStatus
	if !objectID.MatchString(lineage.ExecutionEvidence.ExecutionID) || !oneOf(lineage.ExecutionEvidence.ReviewKind, "reviewed-plan", "one-use-approval", "reviewed-recompute") || !qualityConsistent || (lineage.TransformationKind != "data-clean" && (lineage.ExecutionEvidence.CleanImpact != nil || lineage.ExecutionEvidence.Quality != nil)) || (lineage.TransformationKind == "data-clean" && lineage.ExecutionEvidence.CleanImpact == nil && !legacyCleanEvidence) {
		return nil, errors.New("derived execution evidence is inconsistent")
	}
	rows, err := service.database.QueryContext(ctx, `SELECT ordinal, parent_dataset_id, parent_version_id, parent_display_name FROM derived_dataset_lineage_parents WHERE derived_version_id = ? ORDER BY ordinal`, lineage.VersionID)
	if err != nil {
		return nil, fmt.Errorf("load derived lineage parents: %w", err)
	}
	defer rows.Close()
	lineage.Parents = make([]DerivedLineageParent, 0, 8)
	for rows.Next() {
		var parent DerivedLineageParent
		if err := rows.Scan(&parent.Ordinal, &parent.DatasetID, &parent.VersionID, &parent.DisplayName); err != nil {
			return nil, fmt.Errorf("scan derived lineage parent: %w", err)
		}
		lineage.Parents = append(lineage.Parents, parent)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate derived lineage parents: %w", err)
	}
	if len(lineage.Parents) == 0 {
		return nil, errors.New("derived dataset lineage has no parents")
	}
	return &lineage, nil
}
