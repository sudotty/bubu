package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type derivedExecution struct {
	columns       []QueryResultColumn
	rows          [][]any
	parents       []DerivedLineageParent
	purpose       string
	cleanImpact   *DataCleanImpactPreview
	qualityPolicy *DataCleanQualityPolicy
	quality       *DataCleanQualityEvidence
}

func (service *Service) MaterializeDerivedDataset(
	ctx context.Context,
	input DerivedDatasetCreateInput,
) (DerivedDatasetMaterializationResult, error) {
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" || utf8.RuneCountInString(displayName) > 100 {
		return DerivedDatasetMaterializationResult{}, errors.New("derived dataset display name is invalid")
	}
	if err := validateDerivedTransformation(input.Transformation); err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	if input.Transformation.Kind == "data-clean" {
		if err := validateDataCleanQualityPolicy(input.QualityPolicy, *input.Transformation.CleanPlan); err != nil {
			return DerivedDatasetMaterializationResult{}, err
		}
	} else if input.QualityPolicy != nil {
		return DerivedDatasetMaterializationResult{}, errors.New("quality policy is only accepted for data-clean")
	}
	reviewKind, err := validateDerivedMaterializationReview(input.Transformation, input.Review)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	execution, err := service.executeDerivedTransformation(ctx, input.Transformation)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	if input.Transformation.Kind == "data-clean" {
		quality, qualityErr := service.evaluateDataCleanQuality(ctx, *input.Transformation.CleanPlan, execution, *input.QualityPolicy)
		if qualityErr != nil {
			return DerivedDatasetMaterializationResult{}, qualityErr
		}
		if input.Review.QualityPolicyFingerprint != quality.PolicyFingerprint {
			return DerivedDatasetMaterializationResult{}, errors.New("data-clean reviewed quality policy fingerprint does not match")
		}
		if quality.Status == "blocked" {
			if err := service.recordBlockedDataCleanQuality(ctx, displayName, input.Transformation, *input.QualityPolicy, quality); err != nil {
				return DerivedDatasetMaterializationResult{}, err
			}
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("data-clean quality gate blocked activation: %s", cleanQualityFailureSummary(quality))
		}
		execution.qualityPolicy, execution.quality = input.QualityPolicy, &quality
	}
	return service.createDerivedDataset(ctx, displayName, input.Transformation, execution, reviewKind)
}

func (service *Service) RecomputeDerivedDataset(
	ctx context.Context,
	datasetID string,
) (DerivedDatasetMaterializationResult, error) {
	if !objectID.MatchString(datasetID) {
		return DerivedDatasetMaterializationResult{}, errors.New("derived dataset id is invalid")
	}
	var displayName, kind, rawPlan string
	var rawQualityPolicy sql.NullString
	err := service.database.QueryRowContext(ctx, `
SELECT d.display_name, l.transformation_kind, l.plan_json, l.quality_policy_json
FROM datasets d
JOIN derived_dataset_lineages l ON l.version_id = d.current_version_id
WHERE d.id = ? AND d.source_kind = 'derived'`, datasetID).Scan(&displayName, &kind, &rawPlan, &rawQualityPolicy)
	if errors.Is(err, sql.ErrNoRows) {
		return DerivedDatasetMaterializationResult{}, errors.New("derived dataset lineage was not found")
	}
	if err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("load derived lineage plan: %w", err)
	}
	var transformation DerivedTransformationPlan
	if err := json.Unmarshal([]byte(rawPlan), &transformation); err != nil {
		return DerivedDatasetMaterializationResult{}, fmt.Errorf("decode stored derived plan: %w", err)
	}
	if transformation.Kind != kind {
		return DerivedDatasetMaterializationResult{}, errors.New("stored derived plan kind is inconsistent")
	}
	if err := service.rebindDerivedTransformation(ctx, &transformation); err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	if err := validateDerivedTransformation(transformation); err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	execution, err := service.executeDerivedTransformation(ctx, transformation)
	if err != nil {
		return DerivedDatasetMaterializationResult{}, err
	}
	if transformation.Kind == "data-clean" {
		if !rawQualityPolicy.Valid {
			return DerivedDatasetMaterializationResult{}, errors.New("stored data-clean quality policy is missing")
		}
		var policy DataCleanQualityPolicy
		if err := json.Unmarshal([]byte(rawQualityPolicy.String), &policy); err != nil {
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("decode stored data-clean quality policy: %w", err)
		}
		quality, qualityErr := service.evaluateDataCleanQuality(ctx, *transformation.CleanPlan, execution, policy)
		if qualityErr != nil {
			return DerivedDatasetMaterializationResult{}, qualityErr
		}
		if quality.Status == "blocked" {
			if err := service.recordBlockedDataCleanQuality(ctx, displayName, transformation, policy, quality); err != nil {
				return DerivedDatasetMaterializationResult{}, err
			}
			return DerivedDatasetMaterializationResult{}, fmt.Errorf("data-clean quality gate blocked activation: %s", cleanQualityFailureSummary(quality))
		}
		execution.qualityPolicy, execution.quality = &policy, &quality
	}
	return service.createDerivedVersion(ctx, datasetID, displayName, transformation, execution, "reviewed-recompute")
}

func validateDerivedMaterializationReview(transformation DerivedTransformationPlan, review *DerivedMaterializationReview) (string, error) {
	if transformation.Kind != "data-clean" {
		if review != nil {
			return "", errors.New("materialization review is only accepted for data-clean")
		}
		return "reviewed-plan", nil
	}
	if review == nil || review.Kind != "one-use-approval" {
		return "", errors.New("data-clean materialization requires one-use reviewed evidence")
	}
	_, fingerprint, err := derivedPlanEvidence(transformation)
	if err != nil {
		return "", err
	}
	if review.PlanFingerprint != fingerprint {
		return "", errors.New("data-clean reviewed plan fingerprint does not match")
	}
	if review.QualityPolicyFingerprint == "" {
		return "", errors.New("data-clean review is missing the quality policy fingerprint")
	}
	reviewedAt, err := time.Parse(time.RFC3339, review.ReviewedAt)
	if err != nil {
		return "", errors.New("data-clean review time is invalid")
	}
	now := time.Now().UTC()
	if reviewedAt.After(now.Add(time.Minute)) || reviewedAt.Before(now.Add(-10*time.Minute)) {
		return "", errors.New("data-clean review is expired or from the future")
	}
	return "one-use-approval", nil
}

func validateDerivedTransformation(transformation DerivedTransformationPlan) error {
	switch transformation.Kind {
	case "dataset-query":
		if transformation.DatasetPlan == nil || transformation.GroupPlan != nil || transformation.CleanPlan != nil {
			return errors.New("dataset-query transformation must contain exactly one dataset plan")
		}
		return validateQueryPlanShape(*transformation.DatasetPlan)
	case "group-query":
		if transformation.GroupPlan == nil || transformation.DatasetPlan != nil || transformation.CleanPlan != nil {
			return errors.New("group-query transformation must contain exactly one group plan")
		}
		return validateGroupQueryPlanShape(*transformation.GroupPlan)
	case "data-clean":
		if transformation.CleanPlan == nil || transformation.DatasetPlan != nil || transformation.GroupPlan != nil {
			return errors.New("data-clean transformation must contain exactly one clean plan")
		}
		return validateDataCleanPlan(*transformation.CleanPlan)
	default:
		return errors.New("derived transformation kind is unsupported")
	}
}

func (service *Service) executeDerivedTransformation(
	ctx context.Context,
	transformation DerivedTransformationPlan,
) (derivedExecution, error) {
	switch transformation.Kind {
	case "dataset-query":
		result, err := service.ExecuteQueryPlan(ctx, *transformation.DatasetPlan)
		if err != nil {
			return derivedExecution{}, err
		}
		parents, err := service.derivedParents(ctx, []GroupQuerySource{{
			DatasetID: result.DatasetID,
			VersionID: result.VersionID,
		}})
		return derivedExecution{columns: result.Columns, rows: result.Rows, parents: parents, purpose: transformation.DatasetPlan.Purpose}, err
	case "group-query":
		result, err := service.ExecuteGroupQueryPlan(ctx, *transformation.GroupPlan)
		if err != nil {
			return derivedExecution{}, err
		}
		parents, err := service.derivedParents(ctx, result.SourceVersions)
		return derivedExecution{columns: result.Columns, rows: result.Rows, parents: parents, purpose: transformation.GroupPlan.Purpose}, err
	case "data-clean":
		return service.executeDataCleanPlan(ctx, *transformation.CleanPlan)
	default:
		return derivedExecution{}, errors.New("derived transformation kind is unsupported")
	}
}

func (service *Service) derivedParents(
	ctx context.Context,
	sources []GroupQuerySource,
) ([]DerivedLineageParent, error) {
	parents := make([]DerivedLineageParent, len(sources))
	for index, source := range sources {
		var displayName string
		err := service.database.QueryRowContext(ctx, `
SELECT d.display_name
FROM datasets d
JOIN dataset_versions v ON v.dataset_id = d.id
WHERE d.id = ? AND v.id = ? AND v.status = 'ready'`, source.DatasetID, source.VersionID).Scan(&displayName)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("derived transformation parent version was not found")
		}
		if err != nil {
			return nil, fmt.Errorf("load derived transformation parent: %w", err)
		}
		parents[index] = DerivedLineageParent{
			Ordinal: index, DatasetID: source.DatasetID, VersionID: source.VersionID, DisplayName: displayName,
		}
	}
	return parents, nil
}

func (service *Service) rebindDerivedTransformation(ctx context.Context, transformation *DerivedTransformationPlan) error {
	switch transformation.Kind {
	case "dataset-query":
		if transformation.DatasetPlan == nil {
			return errors.New("stored dataset transformation is missing its plan")
		}
		var versionID string
		if err := service.database.QueryRowContext(ctx, `
SELECT current_version_id FROM datasets WHERE id = ?`, transformation.DatasetPlan.DatasetID).Scan(&versionID); err != nil {
			return fmt.Errorf("rebind derived dataset parent: %w", err)
		}
		transformation.DatasetPlan.VersionID = versionID
	case "group-query":
		if transformation.GroupPlan == nil {
			return errors.New("stored group transformation is missing its plan")
		}
		group, err := service.GetGroup(ctx, transformation.GroupPlan.GroupID)
		if err != nil {
			return err
		}
		if len(group.Members) != len(transformation.GroupPlan.Sources) {
			return errors.New("business topic membership changed; create and approve a new transformation")
		}
		for index, member := range group.Members {
			if transformation.GroupPlan.Sources[index].DatasetID != member.ID {
				return errors.New("business topic order changed; create and approve a new transformation")
			}
			transformation.GroupPlan.Sources[index].VersionID = member.VersionID
		}
	case "data-clean":
		if transformation.CleanPlan == nil {
			return errors.New("stored data-clean transformation is missing its plan")
		}
		return service.rebindDataCleanPlan(ctx, transformation.CleanPlan)
	default:
		return errors.New("stored derived transformation kind is unsupported")
	}
	return nil
}
