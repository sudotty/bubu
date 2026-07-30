package data

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

func (service *Service) createDerivedDataset(ctx context.Context, displayName string, transformation DerivedTransformationPlan, execution derivedExecution, reviewKind string) (DerivedDatasetMaterializationResult, error) {
	datasetID, err := newID()
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	versionID, err := newID()
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("begin derived dataset materialization: %w", err)
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO datasets(id, display_name, source_kind, source_name, source_locator, created_at, updated_at)
VALUES (?, ?, 'derived', ?, '', ?, ?)`, datasetID, displayName, derivedSourceName(execution.purpose), now, now); err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("create derived dataset: %w", err)
	}
	return service.materializeDerivedVersion(ctx, transaction, versionTarget{
		datasetID: datasetID, versionID: versionID, version: 1, displayName: displayName,
		sourceKind: "derived", sourceName: derivedSourceName(execution.purpose), importedAt: now,
	}, transformation, execution, reviewKind)
}

func (service *Service) createDerivedVersion(ctx context.Context, datasetID, displayName string, transformation DerivedTransformationPlan, execution derivedExecution, reviewKind string) (DerivedDatasetMaterializationResult, error) {
	versionID, err := newID()
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("begin derived dataset recompute: %w", err)
	}
	defer transaction.Rollback()
	var currentVersion int
	var sourceKind string
	if err := transaction.QueryRowContext(ctx, `
SELECT v.ordinal, d.source_kind
FROM datasets d JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ?`, datasetID).Scan(&currentVersion, &sourceKind); err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("load derived dataset version: %w", err)
	}
	if sourceKind != "derived" {
		return DerivedDatasetMaterializationResult{}, errors.New("only a derived dataset can be recomputed")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	return service.materializeDerivedVersion(ctx, transaction, versionTarget{
		datasetID: datasetID, versionID: versionID, version: currentVersion + 1, displayName: displayName,
		sourceKind: "derived", sourceName: derivedSourceName(execution.purpose), importedAt: now,
	}, transformation, execution, reviewKind)
}

func (service *Service) materializeDerivedVersion(ctx context.Context, transaction *sql.Tx, target versionTarget, transformation DerivedTransformationPlan, execution derivedExecution, reviewKind string) (DerivedDatasetMaterializationResult, error) {
	rawPlan, fingerprint, err := derivedPlanEvidence(transformation)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	executionID, err := newID()
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	var cleanImpactJSON any
	if execution.cleanImpact != nil {
		execution.cleanImpact.PlanFingerprint = fingerprint
		rawImpact, marshalErr := json.Marshal(execution.cleanImpact)
		if marshalErr != nil {
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("encode data-clean execution impact: %w", marshalErr)
		}
		cleanImpactJSON = string(rawImpact)
	}
	var qualityPolicyJSON, qualityEvidenceJSON any
	qualityStatus := "not-configured"
	warnings := []string{}
	if execution.qualityPolicy != nil && execution.quality != nil {
		rawPolicy, _, marshalErr := dataCleanQualityPolicyEvidence(*execution.qualityPolicy)
		if marshalErr != nil {
			return DerivedDatasetMaterializationResult{}, marshalErr
		}
		rawQuality, marshalErr := json.Marshal(execution.quality)
		if marshalErr != nil {
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("encode data-clean quality evidence: %w", marshalErr)
		}
		qualityPolicyJSON, qualityEvidenceJSON, qualityStatus = string(rawPolicy), string(rawQuality), execution.quality.Status
		for _, result := range execution.quality.Results {
			if !result.Passed && result.Severity == "warning" {
				warnings = append(warnings, result.RuleID+": "+result.Observed)
			}
		}
	}
	rawWarnings, err := json.Marshal(warnings)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("encode execution warnings: %w", err)
	}
	header := make([]string, len(execution.columns))
	for index, column := range execution.columns {
		header[index] = column.Label
	}
	table := sourceTable{displayName: target.displayName, header: header, walkRows: func(ctx context.Context, yield func([]string) error) error {
		for _, row := range execution.rows {
			if err := ctx.Err(); err != nil {
				return err
			}
			values := make([]string, len(row))
			for index, value := range row {
				values[index] = derivedCellText(value)
			}
			if err := yield(values); err != nil {
				return err
			}
		}
		return nil
	}}
	dataset, err := materializeVersion(ctx, transaction, target, table, fingerprint, int64(len(rawPlan)))
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	// The plan fingerprint is durable lineage evidence, not a source location.
	// Keeping source_locator empty preserves the backup boundary that forbids
	// persisted local paths while the lineage table retains the exact digest.
	if err := activateVersion(ctx, transaction, target, ""); err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO derived_dataset_lineages(
    dataset_id, version_id, transformation_kind, purpose, plan_json,
    plan_fingerprint, execution_id, review_kind, quality_gate_status,
    warnings_json, clean_impact_json, quality_policy_json, quality_evidence_json, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, target.datasetID, target.versionID, transformation.Kind,
		execution.purpose, string(rawPlan), fingerprint, executionID, reviewKind, qualityStatus, string(rawWarnings), cleanImpactJSON, qualityPolicyJSON, qualityEvidenceJSON, target.importedAt); err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("store derived dataset lineage: %w", err)
	}
	for _, parent := range execution.parents {
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO derived_dataset_lineage_parents(
    derived_version_id, ordinal, parent_dataset_id, parent_version_id, parent_display_name
) VALUES (?, ?, ?, ?, ?)`, target.versionID, parent.Ordinal, parent.DatasetID, parent.VersionID, parent.DisplayName); err != nil {
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("store derived lineage parent: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("commit derived dataset materialization: %w", err)
	}
	lineage := DerivedDatasetLineage{
		DatasetID: target.datasetID, VersionID: target.versionID, TransformationKind: transformation.Kind,
		Purpose: execution.purpose, PlanFingerprint: fingerprint, Parents: execution.parents, CreatedAt: target.importedAt,
		ExecutionEvidence: DerivedExecutionEvidence{ExecutionID: executionID, ReviewKind: reviewKind, QualityGateStatus: qualityStatus, Warnings: warnings, CleanImpact: execution.cleanImpact, Quality: execution.quality},
	}
	return DerivedDatasetMaterializationResult{Dataset: dataset, Lineage: lineage}, nil
}

func derivedPlanEvidence(transformation DerivedTransformationPlan) ([]byte, string, error) {
	raw, err := json.Marshal(transformation)
	if err != nil {
		return nil, "", fmt.Errorf("encode derived transformation plan: %w", err)
	}
	if len(raw) > 100_000 {
		return nil, "", errors.New("derived transformation plan is too large")
	}
	digest := sha256.Sum256(raw)
	return raw, hex.EncodeToString(digest[:]), nil
}

func derivedSourceName(purpose string) string {
	name := "派生 · " + strings.TrimSpace(purpose)
	if utf8.RuneCountInString(name) <= 500 {
		return name
	}
	return string([]rune(name)[:500])
}

func derivedCellText(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case []byte:
		return string(typed)
	case bool:
		return strconv.FormatBool(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case float64:
		return strconv.FormatFloat(typed, 'g', -1, 64)
	default:
		return fmt.Sprint(typed)
	}
}
