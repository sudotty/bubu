package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math"
	"time"
)

func validateBackupReconciliationArtifacts(ctx context.Context, database *sql.DB) error {
	rows, err := database.QueryContext(ctx, `SELECT id, plan_json, plan_fingerprint, result_json, left_dataset_id, left_version_id, right_dataset_id, right_version_id FROM reconciliation_artifacts`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, rawPlan, fingerprint, rawResult, leftDataset, leftVersion, rightDataset, rightVersion string
		if err := rows.Scan(&id, &rawPlan, &fingerprint, &rawResult, &leftDataset, &leftVersion, &rightDataset, &rightVersion); err != nil {
			return err
		}
		var plan ReconciliationPlan
		var artifact ReconciliationArtifact
		if !objectID.MatchString(id) || json.Unmarshal([]byte(rawPlan), &plan) != nil || json.Unmarshal([]byte(rawResult), &artifact) != nil {
			return errors.New("backup contains malformed reconciliation evidence")
		}
		_, actualFingerprint, err := reconciliationPlanEvidence(plan)
		if err != nil || fingerprint != actualFingerprint || artifact.ID != id || artifact.PlanFingerprint != fingerprint || artifact.SchemaVersion != 1 || artifact.Completion.Status != "completed" || artifact.Completion.ClassificationCount != len(artifact.Classifications) {
			return errors.New("backup contains inconsistent reconciliation evidence")
		}
		if plan.Comparison.Sources.Left.DatasetID != leftDataset || plan.Comparison.Sources.Left.VersionID != leftVersion || plan.Comparison.Sources.Right.DatasetID != rightDataset || plan.Comparison.Sources.Right.VersionID != rightVersion {
			return errors.New("backup contains mismatched reconciliation sources")
		}
	}
	return rows.Err()
}

func validateBackupReconciliationReplay(ctx context.Context, database *sql.DB) error {
	if err := validateBackupReconciliationDefinitions(ctx, database); err != nil {
		return err
	}
	return validateBackupReconciliationReplayEvents(ctx, database)
}

func validateBackupReconciliationDefinitions(ctx context.Context, database *sql.DB) error {
	rows, err := database.QueryContext(ctx, `
SELECT d.id, d.plan_json, d.plan_fingerprint, d.left_dataset_id, d.right_dataset_id,
       d.baseline_preview_json, d.last_artifact_id, d.active, d.created_at, d.updated_at,
       a.result_json
FROM reconciliation_definitions d
JOIN reconciliation_artifacts a ON a.id = d.last_artifact_id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, rawPlan, fingerprint, leftDataset, rightDataset, rawBaseline, lastArtifactID, createdAt, updatedAt, rawArtifact string
		var active int
		if err := rows.Scan(&id, &rawPlan, &fingerprint, &leftDataset, &rightDataset, &rawBaseline, &lastArtifactID, &active, &createdAt, &updatedAt, &rawArtifact); err != nil {
			return err
		}
		var plan ReconciliationPlan
		var baseline ReconciliationPreview
		var artifact ReconciliationArtifact
		if !objectID.MatchString(id) || json.Unmarshal([]byte(rawPlan), &plan) != nil || json.Unmarshal([]byte(rawBaseline), &baseline) != nil || json.Unmarshal([]byte(rawArtifact), &artifact) != nil {
			return errors.New("backup contains malformed reconciliation definition")
		}
		_, actualFingerprint, planErr := reconciliationPlanEvidence(plan)
		if planErr != nil || fingerprint != actualFingerprint || plan.Comparison.Sources.Left.DatasetID != leftDataset || plan.Comparison.Sources.Right.DatasetID != rightDataset || (active != 0 && active != 1) {
			return errors.New("backup contains inconsistent reconciliation definition")
		}
		if !validReconciliationPreviewEvidence(baseline, plan) || artifact.ID != lastArtifactID || artifact.PlanFingerprint != fingerprint {
			return errors.New("backup contains mismatched reconciliation definition evidence")
		}
		if artifact.Completion.ReviewKind == "reviewed-replay" {
			if artifact.Completion.DefinitionID == nil || *artifact.Completion.DefinitionID != id {
				return errors.New("backup contains mismatched reconciliation replay evidence")
			}
		} else if artifact.Completion.ReviewKind != "one-use-approval" || artifact.Completion.DefinitionID != nil {
			return errors.New("backup contains invalid reconciliation review evidence")
		}
		if !validReconciliationTime(createdAt) || !validReconciliationTime(updatedAt) {
			return errors.New("backup contains invalid reconciliation definition timestamps")
		}
	}
	return rows.Err()
}

func validReconciliationPreviewEvidence(preview ReconciliationPreview, plan ReconciliationPlan) bool {
	if !validBackupDigest(preview.PlanFingerprint) || preview.CandidatePairs < 0 || len(preview.Sources) != 2 || len(preview.ControlTotals) != len(plan.ControlTotals) {
		return false
	}
	if preview.Sources[0].Side != "left" || preview.Sources[0].DatasetID != plan.Comparison.Sources.Left.DatasetID || !objectID.MatchString(preview.Sources[0].VersionID) || preview.Sources[0].RowCount < 0 || preview.Sources[0].QualityScore < 0 || preview.Sources[0].QualityScore > 100 || preview.Sources[1].Side != "right" || preview.Sources[1].DatasetID != plan.Comparison.Sources.Right.DatasetID || !objectID.MatchString(preview.Sources[1].VersionID) || preview.Sources[1].RowCount < 0 || preview.Sources[1].QualityScore < 0 || preview.Sources[1].QualityScore > 100 {
		return false
	}
	counts := preview.Counts
	if counts.Matched < 0 || counts.ToleranceMatched < 0 || counts.LeftUnmatched < 0 || counts.RightUnmatched < 0 || counts.LeftDuplicate < 0 || counts.RightDuplicate < 0 || counts.Conflict < 0 || counts.Pending < 0 {
		return false
	}
	for index, total := range preview.ControlTotals {
		planned := plan.ControlTotals[index]
		if total.ID != planned.ID || total.Tolerance != planned.Tolerance || math.IsNaN(total.LeftValue) || math.IsNaN(total.RightValue) || math.IsNaN(total.Difference) || math.IsInf(total.LeftValue, 0) || math.IsInf(total.RightValue, 0) || math.IsInf(total.Difference, 0) {
			return false
		}
	}
	return true
}

func validateBackupReconciliationReplayEvents(ctx context.Context, database *sql.DB) error {
	rows, err := database.QueryContext(ctx, `
SELECT e.id, e.definition_id, e.trigger_dataset_id, e.trigger_version_id, v.dataset_id,
       e.source_signature, e.status, e.reason_kind, e.error, e.artifact_id, e.attempt,
       e.created_at, e.started_at, e.finished_at, a.result_json
FROM reconciliation_replay_events e
JOIN dataset_versions v ON v.id = e.trigger_version_id
LEFT JOIN reconciliation_artifacts a ON a.id = e.artifact_id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, definitionID, triggerDatasetID, triggerVersionID, versionDatasetID, signature, status, createdAt string
		var reason, errorText, artifactID, startedAt, finishedAt, rawArtifact sql.NullString
		var attempt int
		if err := rows.Scan(&id, &definitionID, &triggerDatasetID, &triggerVersionID, &versionDatasetID, &signature, &status, &reason, &errorText, &artifactID, &attempt, &createdAt, &startedAt, &finishedAt, &rawArtifact); err != nil {
			return err
		}
		if !objectID.MatchString(id) || !objectID.MatchString(definitionID) || !objectID.MatchString(triggerDatasetID) || !objectID.MatchString(triggerVersionID) || triggerDatasetID != versionDatasetID || !validBackupDigest(signature) || attempt < 0 || attempt > 3 || !validReconciliationTime(createdAt) {
			return errors.New("backup contains malformed reconciliation replay event")
		}
		if errorText.Valid && (errorText.String == "" || len(errorText.String) > 2000) {
			return errors.New("backup contains invalid reconciliation replay error")
		}
		if startedAt.Valid && !validReconciliationTime(startedAt.String) || finishedAt.Valid && !validReconciliationTime(finishedAt.String) {
			return errors.New("backup contains invalid reconciliation replay timestamps")
		}
		if !validReconciliationReplayState(status, reason, errorText, artifactID, attempt, startedAt.Valid, finishedAt.Valid) {
			return errors.New("backup contains inconsistent reconciliation replay state")
		}
		if artifactID.Valid {
			var artifact ReconciliationArtifact
			if !rawArtifact.Valid || json.Unmarshal([]byte(rawArtifact.String), &artifact) != nil || artifact.ID != artifactID.String || artifact.Completion.ReviewKind != "reviewed-replay" || artifact.Completion.DefinitionID == nil || *artifact.Completion.DefinitionID != definitionID {
				return errors.New("backup contains mismatched reconciliation replay artifact")
			}
		}
	}
	return rows.Err()
}

func validReconciliationReplayState(status string, reason, errorText, artifactID sql.NullString, attempt int, hasStarted, hasFinished bool) bool {
	switch status {
	case "pending":
		return attempt < 3 && !reason.Valid && !errorText.Valid && !artifactID.Valid && !hasStarted && !hasFinished
	case "running":
		return attempt >= 1 && !reason.Valid && !errorText.Valid && !artifactID.Valid && hasStarted && !hasFinished
	case "succeeded":
		return attempt >= 1 && !reason.Valid && !errorText.Valid && artifactID.Valid && hasStarted && hasFinished
	case "paused":
		return attempt >= 1 && reason.Valid && oneOf(reason.String, "schema-drift", "cardinality-change", "control-total-change", "quality-change", "stale-source") && errorText.Valid && !artifactID.Valid && hasStarted && hasFinished
	case "failed":
		return attempt >= 1 && reason.Valid && reason.String == "execution-error" && errorText.Valid && !artifactID.Valid && hasStarted && hasFinished
	case "cancelled":
		return reason.Valid && oneOf(reason.String, "stale-source", "cancelled") && errorText.Valid && !artifactID.Valid && hasFinished
	default:
		return false
	}
}

func validReconciliationTime(value string) bool {
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}
