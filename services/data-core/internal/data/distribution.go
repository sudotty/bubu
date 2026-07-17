package data

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

const (
	distributionBinCount     = 10
	distributionValueCount   = 10
	distributionPreviewRunes = 120
)

func (service *Service) GetColumnDistribution(
	ctx context.Context,
	datasetID string,
	columnName string,
) (ColumnDistribution, error) {
	target, err := service.loadQualityTarget(ctx, datasetID)
	if err != nil {
		return nil, err
	}
	profile, physicalName, err := distributionColumn(target, columnName)
	if err != nil {
		return nil, err
	}
	nonNullCount := target.rowCount - profile.NullCount
	base := ColumnDistributionBase{
		LocalOnly: true, DatasetID: target.datasetID, VersionID: target.versionID,
		Column: profile.Name, InferredType: profile.InferredType, NonNullCount: nonNullCount,
	}
	if nonNullCount == 0 {
		return EmptyColumnDistribution{Kind: "empty", ColumnDistributionBase: base}, nil
	}
	if profile.InferredType == ColumnTypeInteger || profile.InferredType == ColumnTypeReal {
		return service.numericDistribution(ctx, target, profile, physicalName, base)
	}
	return service.categoricalDistribution(ctx, target, physicalName, base)
}

func distributionColumn(
	target qualityTarget,
	columnName string,
) (ColumnProfile, string, error) {
	for _, column := range target.columns {
		if column.Name == columnName {
			physicalName := target.physicalByName[column.Name]
			if !physicalColumnName.MatchString(physicalName) {
				return ColumnProfile{}, "", errors.New("stored physical column failed validation")
			}
			return column, physicalName, nil
		}
	}
	return ColumnProfile{}, "", errors.New("distribution column was not found")
}

func (service *Service) numericDistribution(
	ctx context.Context,
	target qualityTarget,
	profile ColumnProfile,
	physicalName string,
	base ColumnDistributionBase,
) (ColumnDistribution, error) {
	if profile.MinValue == nil || profile.MaxValue == nil {
		return nil, errors.New("numeric profile is missing its range")
	}
	minimum, minErr := strconv.ParseFloat(*profile.MinValue, 64)
	maximum, maxErr := strconv.ParseFloat(*profile.MaxValue, 64)
	if minErr != nil || maxErr != nil {
		return nil, errors.New("numeric profile range is invalid")
	}
	var mean float64
	meanQuery := fmt.Sprintf(
		"SELECT AVG(CAST(%s AS REAL)) FROM %s WHERE %s IS NOT NULL",
		physicalName, target.tableName, physicalName,
	)
	if err := service.database.QueryRowContext(ctx, meanQuery).Scan(&mean); err != nil {
		return nil, fmt.Errorf("calculate numeric distribution mean: %w", err)
	}
	counts := make(map[int]int64, distributionBinCount)
	if minimum == maximum {
		counts[0] = base.NonNullCount
	} else {
		width := (maximum - minimum) / distributionBinCount
		query := fmt.Sprintf(`
SELECT CAST((CAST(%s AS REAL) - ?) / ? AS INTEGER), COUNT(*)
FROM %s
WHERE %s IS NOT NULL
GROUP BY 1`, physicalName, target.tableName, physicalName)
		rows, err := service.database.QueryContext(ctx, query, minimum, width)
		if err != nil {
			return nil, fmt.Errorf("calculate numeric distribution bins: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var index int
			var count int64
			if err := rows.Scan(&index, &count); err != nil {
				return nil, fmt.Errorf("scan numeric distribution bin: %w", err)
			}
			if index < 0 {
				index = 0
			}
			if index >= distributionBinCount {
				index = distributionBinCount - 1
			}
			counts[index] += count
		}
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("iterate numeric distribution bins: %w", err)
		}
	}
	return NumericColumnDistribution{
		Kind: "numeric", ColumnDistributionBase: base,
		Minimum: minimum, Maximum: maximum, Mean: mean,
		Bins: buildHistogramBins(minimum, maximum, counts, base.NonNullCount),
	}, nil
}

func buildHistogramBins(
	minimum float64,
	maximum float64,
	counts map[int]int64,
	nonNullCount int64,
) []HistogramBin {
	if minimum == maximum {
		return []HistogramBin{{
			Minimum: minimum, Maximum: maximum,
			Count: counts[0], Rate: ratio(counts[0], nonNullCount),
		}}
	}
	width := (maximum - minimum) / distributionBinCount
	bins := make([]HistogramBin, distributionBinCount)
	for index := range bins {
		upper := minimum + width*float64(index+1)
		if index == distributionBinCount-1 {
			upper = maximum
		}
		bins[index] = HistogramBin{
			Minimum: minimum + width*float64(index), Maximum: upper,
			Count: counts[index], Rate: ratio(counts[index], nonNullCount),
		}
	}
	return bins
}

func (service *Service) categoricalDistribution(
	ctx context.Context,
	target qualityTarget,
	physicalName string,
	base ColumnDistributionBase,
) (ColumnDistribution, error) {
	query := fmt.Sprintf(`
SELECT substr(%s, 1, ?), length(%s) > ?, COUNT(*)
FROM %s
WHERE %s IS NOT NULL
GROUP BY %s
ORDER BY COUNT(*) DESC, %s COLLATE BINARY ASC
LIMIT ?`, physicalName, physicalName, target.tableName, physicalName, physicalName, physicalName)
	rows, err := service.database.QueryContext(
		ctx, query, distributionPreviewRunes, distributionPreviewRunes, distributionValueCount,
	)
	if err != nil {
		return nil, fmt.Errorf("calculate categorical distribution: %w", err)
	}
	defer rows.Close()
	values := make([]FrequentValue, 0, distributionValueCount)
	var represented int64
	for rows.Next() {
		var preview string
		var truncated bool
		var count int64
		if err := rows.Scan(&preview, &truncated, &count); err != nil {
			return nil, fmt.Errorf("scan categorical distribution value: %w", err)
		}
		preview = strings.Map(safeDistributionRune, preview)
		values = append(values, FrequentValue{
			Preview: preview, Truncated: truncated, Count: count,
			Rate: ratio(count, base.NonNullCount),
		})
		represented += count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categorical distribution: %w", err)
	}
	return CategoricalColumnDistribution{
		Kind: "categorical", ColumnDistributionBase: base,
		Values: values, OtherCount: base.NonNullCount - represented,
	}, nil
}

func safeDistributionRune(value rune) rune {
	switch value {
	case '\n', '\r':
		return '↵'
	case '\t':
		return '⇥'
	default:
		if unicode.IsControl(value) {
			return '�'
		}
		return value
	}
}
