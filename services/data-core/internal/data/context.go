package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const syntheticRowCount = 3
const maximumModelContextColumns = 256

func (service *Service) ModelContext(
	ctx context.Context,
	datasetID string,
	disclosure DisclosureLevel,
) (ModelContextResult, error) {
	if !objectID.MatchString(datasetID) {
		return ModelContextResult{}, errors.New("dataset id is invalid")
	}
	if disclosure != DisclosureSchemaOnly && disclosure != DisclosureSchemaSynthetic {
		return ModelContextResult{}, errors.New("unsupported disclosure level")
	}
	var versionID string
	var rowCount int64
	err := service.database.QueryRowContext(ctx, `
SELECT v.id, v.row_count
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, datasetID).Scan(&versionID, &rowCount)
	if errors.Is(err, sql.ErrNoRows) {
		return ModelContextResult{}, errors.New("dataset not found")
	}
	if err != nil {
		return ModelContextResult{}, fmt.Errorf("load model context: %w", err)
	}
	profiles, _, err := service.loadColumns(ctx, versionID)
	if err != nil {
		return ModelContextResult{}, err
	}
	if len(profiles) > maximumModelContextColumns {
		return ModelContextResult{}, fmt.Errorf("dataset has more than %d columns; select a narrower dataset before AI analysis", maximumModelContextColumns)
	}
	columns := make([]ModelContextColumn, len(profiles))
	for index, profile := range profiles {
		columns[index] = ModelContextColumn{
			Name:     profile.Name,
			Type:     profile.InferredType,
			Nullable: profile.Nullable,
			Unique:   rowCount > 0 && profile.NullCount == 0 && profile.DistinctCount == rowCount,
		}
	}
	result := ModelContextResult{
		DatasetID:  datasetID,
		VersionID:  versionID,
		Disclosure: disclosure,
		Columns:    columns,
	}
	if disclosure == DisclosureSchemaSynthetic {
		result.SyntheticRows = generateSyntheticRows(columns, syntheticRowCount)
	} else {
		result.SyntheticRows = make([][]any, 0)
	}
	return result, nil
}

func generateSyntheticRows(columns []ModelContextColumn, count int) [][]any {
	rows := make([][]any, count)
	for rowIndex := range rows {
		row := make([]any, len(columns))
		for columnIndex, column := range columns {
			row[columnIndex] = syntheticValue(column.Type, rowIndex, columnIndex)
		}
		rows[rowIndex] = row
	}
	return rows
}

func syntheticValue(columnType ColumnType, rowIndex, columnIndex int) any {
	switch columnType {
	case ColumnTypeNull:
		return nil
	case ColumnTypeBoolean:
		return rowIndex%2 == 0
	case ColumnTypeInteger:
		return (rowIndex+1)*10 + columnIndex
	case ColumnTypeReal:
		return float64((rowIndex+1)*10+columnIndex) + 0.25
	case ColumnTypeDateTime:
		return time.Date(2030, time.January, rowIndex+1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	default:
		return fmt.Sprintf("synthetic_c%d_r%d", columnIndex+1, rowIndex+1)
	}
}
