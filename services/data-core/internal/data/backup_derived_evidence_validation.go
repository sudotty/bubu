package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

func validateBackupDerivedExecutionEvidence(ctx context.Context, database *sql.DB, schemaVersion int) error {
	rows, err := database.QueryContext(ctx, `
SELECT transformation_kind, plan_fingerprint, execution_id, review_kind,
       quality_gate_status, warnings_json, clean_impact_json, quality_policy_json, quality_evidence_json
FROM derived_dataset_lineages`)
	if err != nil {
		return fmt.Errorf("read backup derived execution evidence: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var kind, fingerprint, executionID, reviewKind, qualityStatus, warningsJSON string
		var impactJSON, policyJSON, qualityJSON sql.NullString
		if err := rows.Scan(&kind, &fingerprint, &executionID, &reviewKind, &qualityStatus, &warningsJSON, &impactJSON, &policyJSON, &qualityJSON); err != nil {
			return fmt.Errorf("scan backup derived execution evidence: %w", err)
		}
		var warnings []string
		if !objectID.MatchString(executionID) || !validBackupDigest(fingerprint) || !oneOf(reviewKind, "reviewed-plan", "one-use-approval", "reviewed-recompute") || !oneOf(qualityStatus, "not-configured", "passed", "warning") || json.Unmarshal([]byte(warningsJSON), &warnings) != nil || warnings == nil || len(warnings) > 40 {
			return errors.New("backup contains invalid derived execution evidence")
		}
		if qualityStatus == "not-configured" {
			if policyJSON.Valid || qualityJSON.Valid {
				return errors.New("backup contains unexpected quality-gate evidence")
			}
		} else {
			var policy DataCleanQualityPolicy
			var evidence DataCleanQualityEvidence
			if kind != "data-clean" || !policyJSON.Valid || !qualityJSON.Valid || json.Unmarshal([]byte(policyJSON.String), &policy) != nil || json.Unmarshal([]byte(qualityJSON.String), &evidence) != nil || validateDataCleanQualityPolicy(&policy, DataCleanPlan{SchemaVersion: 1, Sources: make([]DataCleanSource, 8)}) != nil || evidence.Status != qualityStatus || evidence.Status == "blocked" || len(evidence.Results) != len(policy.Rules) {
				return errors.New("backup contains invalid quality-gate evidence")
			}
			_, policyFingerprint, err := dataCleanQualityPolicyEvidence(policy)
			if err != nil || evidence.PolicyFingerprint != policyFingerprint {
				return errors.New("backup contains mismatched quality-gate evidence")
			}
		}
		if impactJSON.Valid {
			var impact DataCleanImpactPreview
			if kind != "data-clean" || json.Unmarshal([]byte(impactJSON.String), &impact) != nil || impact.PlanFingerprint != fingerprint || len(impact.Sources) < 1 || len(impact.Operations) < 1 {
				return errors.New("backup contains invalid data-clean impact evidence")
			}
		} else if kind == "data-clean" && reviewKind != "reviewed-plan" {
			return errors.New("backup contains missing reviewed data-clean impact evidence")
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if schemaVersion < 21 {
		return nil
	}
	attempts, err := database.QueryContext(ctx, `SELECT execution_id, plan_json, plan_fingerprint, quality_policy_json, quality_evidence_json, status FROM data_clean_quality_attempts`)
	if err != nil {
		return fmt.Errorf("read backup blocked quality attempts: %w", err)
	}
	defer attempts.Close()
	for attempts.Next() {
		var executionID, planJSON, planFingerprint, policyJSON, evidenceJSON, status string
		if err := attempts.Scan(&executionID, &planJSON, &planFingerprint, &policyJSON, &evidenceJSON, &status); err != nil {
			return fmt.Errorf("scan backup blocked quality attempt: %w", err)
		}
		var transformation DerivedTransformationPlan
		var policy DataCleanQualityPolicy
		var evidence DataCleanQualityEvidence
		if !objectID.MatchString(executionID) || !validBackupDigest(planFingerprint) || status != "blocked" || json.Unmarshal([]byte(planJSON), &transformation) != nil || transformation.Kind != "data-clean" || transformation.CleanPlan == nil || json.Unmarshal([]byte(policyJSON), &policy) != nil || json.Unmarshal([]byte(evidenceJSON), &evidence) != nil || evidence.Status != "blocked" || len(evidence.Results) != len(policy.Rules) {
			return errors.New("backup contains invalid blocked quality attempt")
		}
		_, actualPlanFingerprint, planErr := derivedPlanEvidence(transformation)
		_, actualPolicyFingerprint, policyErr := dataCleanQualityPolicyEvidence(policy)
		if planErr != nil || policyErr != nil || actualPlanFingerprint != planFingerprint || actualPolicyFingerprint != evidence.PolicyFingerprint {
			return errors.New("backup contains mismatched blocked quality attempt")
		}
	}
	if err := attempts.Err(); err != nil {
		return err
	}
	if schemaVersion < 22 {
		return nil
	}
	var eventCount, invalid int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM derived_recompute_events").Scan(&eventCount); err != nil || eventCount > maximumDerivedRecomputeEvents {
		return errors.New("backup exceeds the derived recompute event limit")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM derived_recompute_events
WHERE length(id) <> 32 OR length(source_dataset_id) <> 32 OR length(source_version_id) <> 32 OR length(target_dataset_id) <> 32
   OR attempt NOT BETWEEN 0 AND 3
   OR status NOT IN ('pending', 'running', 'succeeded', 'paused', 'failed', 'cancelled')
   OR (status = 'pending' AND (started_at IS NOT NULL OR finished_at IS NOT NULL OR reason_kind IS NOT NULL OR error IS NOT NULL OR result_version_id IS NOT NULL))
   OR (status = 'running' AND (started_at IS NULL OR finished_at IS NOT NULL OR reason_kind IS NOT NULL OR error IS NOT NULL OR result_version_id IS NOT NULL))
   OR (status = 'succeeded' AND (started_at IS NULL OR finished_at IS NULL OR reason_kind IS NOT NULL OR error IS NOT NULL OR result_version_id IS NULL))
   OR (status IN ('paused','failed','cancelled') AND (started_at IS NULL OR finished_at IS NULL OR reason_kind IS NULL OR error IS NULL OR result_version_id IS NOT NULL))`).Scan(&invalid); err != nil || invalid != 0 {
		return errors.New("backup contains invalid derived recompute evidence")
	}
	return nil
}
