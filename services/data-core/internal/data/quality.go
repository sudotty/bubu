package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type qualityTarget struct {
	datasetID      string
	versionID      string
	tableName      string
	rowCount       int64
	columns        []ColumnProfile
	physicalByName map[string]string
}

func (service *Service) GetQualityReport(
	ctx context.Context,
	datasetID string,
) (DatasetQualityReport, error) {
	target, err := service.loadQualityTarget(ctx, datasetID)
	if err != nil {
		return DatasetQualityReport{}, err
	}
	rules, err := service.loadValidationRules(ctx, target)
	if err != nil {
		return DatasetQualityReport{}, err
	}
	validation := make([]ValidationResult, len(rules))
	for index, rule := range rules {
		result, err := service.evaluateValidationRule(ctx, target, index, rule)
		if err != nil {
			return DatasetQualityReport{}, err
		}
		validation[index] = result
	}
	columns, findings, score := deriveQuality(target, validation)
	return DatasetQualityReport{
		DatasetID:  target.datasetID,
		VersionID:  target.versionID,
		RowCount:   target.rowCount,
		Score:      score,
		Columns:    columns,
		Findings:   findings,
		Rules:      rules,
		Validation: validation,
	}, nil
}

func (service *Service) loadQualityTarget(ctx context.Context, datasetID string) (qualityTarget, error) {
	if !objectID.MatchString(datasetID) {
		return qualityTarget{}, errors.New("dataset id is invalid")
	}
	var target qualityTarget
	err := service.database.QueryRowContext(ctx, `
SELECT d.id, v.id, v.table_name, v.row_count
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, datasetID).Scan(
		&target.datasetID,
		&target.versionID,
		&target.tableName,
		&target.rowCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return qualityTarget{}, errors.New("dataset not found")
	}
	if err != nil {
		return qualityTarget{}, fmt.Errorf("load quality target: %w", err)
	}
	if !internalTableName.MatchString(target.tableName) {
		return qualityTarget{}, errors.New("stored table name failed validation")
	}
	columns, physicalNames, err := service.loadColumns(ctx, target.versionID)
	if err != nil {
		return qualityTarget{}, err
	}
	target.columns = columns
	target.physicalByName = make(map[string]string, len(columns))
	for index, column := range columns {
		target.physicalByName[column.Name] = physicalNames[index]
	}
	return target, nil
}

func deriveQuality(
	target qualityTarget,
	validation []ValidationResult,
) ([]ColumnQuality, []QualityFinding, int) {
	columns := make([]ColumnQuality, len(target.columns))
	findings := make([]QualityFinding, 0)
	penalty := 0
	if target.rowCount == 0 {
		findings = append(findings, QualityFinding{Kind: "empty-dataset", Severity: "warning"})
		penalty += 25
	}
	for index, profile := range target.columns {
		nullRate := ratio(profile.NullCount, target.rowCount)
		distinctRate := ratio(profile.DistinctCount, target.rowCount-profile.NullCount)
		columns[index] = ColumnQuality{
			Name:          profile.Name,
			InferredType:  profile.InferredType,
			RowCount:      target.rowCount,
			NullCount:     profile.NullCount,
			NullRate:      nullRate,
			DistinctCount: profile.DistinctCount,
			DistinctRate:  distinctRate,
			MinValue:      profile.MinValue,
			MaxValue:      profile.MaxValue,
		}
		column := profile.Name
		switch {
		case target.rowCount > 0 && profile.NullCount == target.rowCount:
			findings = append(findings, QualityFinding{Kind: "all-null", Severity: "error", Column: &column})
			penalty += 25
		case nullRate >= 0.2:
			findings = append(findings, QualityFinding{Kind: "high-null-rate", Severity: "warning", Column: &column})
			penalty += 10
		}
		if target.rowCount-profile.NullCount > 1 && profile.DistinctCount == 1 {
			findings = append(findings, QualityFinding{Kind: "constant", Severity: "warning", Column: &column})
			penalty += 5
		}
		if target.rowCount > 1 && profile.NullCount == 0 && profile.DistinctCount == target.rowCount {
			findings = append(findings, QualityFinding{Kind: "candidate-key", Severity: "info", Column: &column})
		}
	}
	for _, result := range validation {
		if result.FailedRows > 0 {
			penalty += 15
		}
	}
	if penalty > 100 {
		penalty = 100
	}
	return columns, findings, 100 - penalty
}

func ratio(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}
