package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type storedProfile struct {
	nullable      bool
	nullCount     int64
	distinctCount int64
	minValue      *string
	maxValue      *string
}

func profileColumn(
	ctx context.Context,
	transaction *sql.Tx,
	tableName string,
	physicalName string,
	rowCount int64,
) (storedProfile, error) {
	query := fmt.Sprintf(
		"SELECT COUNT(%s), COUNT(DISTINCT %s), MIN(%s), MAX(%s) FROM %s",
		physicalName,
		physicalName,
		physicalName,
		physicalName,
		tableName,
	)
	var nonNullCount int64
	var distinctCount int64
	var minimum sql.NullString
	var maximum sql.NullString
	if err := transaction.QueryRowContext(ctx, query).Scan(&nonNullCount, &distinctCount, &minimum, &maximum); err != nil {
		return storedProfile{}, fmt.Errorf("profile column: %w", err)
	}
	nullCount := rowCount - nonNullCount
	return storedProfile{
		nullable:      nullCount > 0,
		nullCount:     nullCount,
		distinctCount: distinctCount,
		minValue:      nullableString(minimum),
		maxValue:      nullableString(maximum),
	}, nil
}

func (service *Service) loadColumns(ctx context.Context, versionID string) ([]ColumnProfile, []string, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT ordinal, source_name, name, physical_name, inferred_type,
       nullable, null_count, distinct_count, min_value, max_value
FROM dataset_columns
WHERE version_id = ?
ORDER BY ordinal`, versionID)
	if err != nil {
		return nil, nil, fmt.Errorf("load dataset columns: %w", err)
	}
	defer rows.Close()
	columns := make([]ColumnProfile, 0)
	physicalNames := make([]string, 0)
	for rows.Next() {
		var column ColumnProfile
		var physicalName string
		var nullable int
		var minimum sql.NullString
		var maximum sql.NullString
		if err := rows.Scan(
			&column.Ordinal,
			&column.SourceName,
			&column.Name,
			&physicalName,
			&column.InferredType,
			&nullable,
			&column.NullCount,
			&column.DistinctCount,
			&minimum,
			&maximum,
		); err != nil {
			return nil, nil, fmt.Errorf("scan dataset column: %w", err)
		}
		if !physicalColumnName.MatchString(physicalName) {
			return nil, nil, errors.New("stored physical column failed validation")
		}
		column.Nullable = nullable == 1
		column.MinValue = nullableString(minimum)
		column.MaxValue = nullableString(maximum)
		columns = append(columns, column)
		physicalNames = append(physicalNames, physicalName)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate dataset columns: %w", err)
	}
	if len(columns) == 0 {
		return nil, nil, errors.New("dataset has no columns")
	}
	return columns, physicalNames, nil
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	result := value.String
	return &result
}
