package data

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

func (service *Service) recordBlockedDataCleanQuality(ctx context.Context, displayName string, transformation DerivedTransformationPlan, policy DataCleanQualityPolicy, evidence DataCleanQualityEvidence) error {
	executionID, err := newID()
	if err != nil {
		return err
	}
	rawPlan, planFingerprint, err := derivedPlanEvidence(transformation)
	if err != nil {
		return err
	}
	rawPolicy, _, err := dataCleanQualityPolicyEvidence(policy)
	if err != nil {
		return err
	}
	rawEvidence, err := json.Marshal(evidence)
	if err != nil {
		return fmt.Errorf("encode blocked quality evidence: %w", err)
	}
	_, err = service.database.ExecContext(ctx, `
INSERT INTO data_clean_quality_attempts(
    execution_id, display_name, plan_json, plan_fingerprint,
    quality_policy_json, quality_evidence_json, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, 'blocked', ?)`, executionID, displayName, string(rawPlan), planFingerprint, string(rawPolicy), string(rawEvidence), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil {
		return fmt.Errorf("store blocked data-clean quality evidence: %w", err)
	}
	return nil
}
