package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

const maximumDatasetVersions = 10_000

func (service *Service) ListDatasets(ctx context.Context) ([]DatasetSummary, error) {
	rows, err := service.database.QueryContext(ctx, `
SELECT d.id, v.id, d.display_name, d.source_kind, d.source_name,
       v.row_count, v.column_count, v.imported_at, v.ordinal
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE v.status = 'ready'
ORDER BY d.updated_at DESC, d.id`)
	if err != nil {
		return nil, fmt.Errorf("list datasets: %w", err)
	}
	defer rows.Close()
	result := make([]DatasetSummary, 0)
	for rows.Next() {
		var dataset DatasetSummary
		if err := rows.Scan(
			&dataset.ID,
			&dataset.VersionID,
			&dataset.DisplayName,
			&dataset.SourceKind,
			&dataset.SourceName,
			&dataset.RowCount,
			&dataset.ColumnCount,
			&dataset.ImportedAt,
			&dataset.Version,
		); err != nil {
			return nil, fmt.Errorf("scan dataset: %w", err)
		}
		result = append(result, dataset)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate datasets: %w", err)
	}
	return result, nil
}

func (service *Service) RenameDataset(ctx context.Context, input DatasetRenameInput) (DatasetSummary, error) {
	if !objectID.MatchString(input.DatasetID) {
		return DatasetSummary{}, errors.New("dataset id is invalid")
	}
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" || utf8.RuneCountInString(displayName) > 100 {
		return DatasetSummary{}, errors.New("dataset display name is invalid")
	}
	result, err := service.database.ExecContext(ctx, `
UPDATE datasets SET display_name = ?, updated_at = ? WHERE id = ?`,
		displayName, time.Now().UTC().Format(time.RFC3339Nano), input.DatasetID)
	if err != nil {
		return DatasetSummary{}, fmt.Errorf("rename dataset: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return DatasetSummary{}, errors.New("dataset not found")
	}
	datasets, err := service.ListDatasets(ctx)
	if err != nil {
		return DatasetSummary{}, err
	}
	for _, dataset := range datasets {
		if dataset.ID == input.DatasetID {
			return dataset, nil
		}
	}
	return DatasetSummary{}, errors.New("renamed dataset is unavailable")
}

func (service *Service) ListDatasetVersions(ctx context.Context, datasetID string) ([]DatasetVersionSummary, error) {
	if !objectID.MatchString(datasetID) {
		return nil, errors.New("dataset id is invalid")
	}
	rows, err := service.database.QueryContext(ctx, `
SELECT v.id, v.ordinal, v.source_name, v.row_count, v.column_count, v.imported_at,
       CASE WHEN d.current_version_id = v.id THEN 1 ELSE 0 END
FROM datasets d
JOIN dataset_versions v ON v.dataset_id = d.id
WHERE d.id = ? AND v.status = 'ready'
ORDER BY v.ordinal DESC
LIMIT ?`, datasetID, maximumDatasetVersions)
	if err != nil {
		return nil, fmt.Errorf("list dataset versions: %w", err)
	}
	defer rows.Close()
	versions := make([]DatasetVersionSummary, 0)
	for rows.Next() {
		var version DatasetVersionSummary
		var current int
		if err := rows.Scan(&version.VersionID, &version.Version, &version.SourceName, &version.RowCount, &version.ColumnCount, &version.ImportedAt, &current); err != nil {
			return nil, fmt.Errorf("scan dataset version: %w", err)
		}
		version.Current = current == 1
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dataset versions: %w", err)
	}
	if len(versions) == 0 {
		return nil, errors.New("dataset not found")
	}
	return versions, nil
}

func (service *Service) Preview(ctx context.Context, datasetID string, limit, offset int) (PreviewResult, error) {
	if strings.TrimSpace(datasetID) == "" {
		return PreviewResult{}, errors.New("dataset id is required")
	}
	if limit < 1 || limit > 500 {
		return PreviewResult{}, errors.New("preview limit must be between 1 and 500")
	}
	if offset < 0 {
		return PreviewResult{}, errors.New("preview offset cannot be negative")
	}
	var versionID string
	var tableName string
	var totalRows int64
	err := service.database.QueryRowContext(ctx, `
SELECT v.id, v.table_name, v.row_count
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, datasetID).Scan(&versionID, &tableName, &totalRows)
	if errors.Is(err, sql.ErrNoRows) {
		return PreviewResult{}, errors.New("dataset not found")
	}
	if err != nil {
		return PreviewResult{}, fmt.Errorf("load dataset preview metadata: %w", err)
	}
	if !internalTableName.MatchString(tableName) {
		return PreviewResult{}, errors.New("stored table name failed validation")
	}

	columns, physicalNames, err := service.loadColumns(ctx, versionID)
	if err != nil {
		return PreviewResult{}, err
	}
	query := fmt.Sprintf(
		"SELECT %s FROM %s ORDER BY __row_number LIMIT ? OFFSET ?",
		strings.Join(physicalNames, ", "),
		tableName,
	)
	rows, err := service.database.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return PreviewResult{}, fmt.Errorf("query dataset preview: %w", err)
	}
	defer rows.Close()
	previewRows := make([][]any, 0, limit)
	for rows.Next() {
		values := make([]sql.NullString, len(columns))
		destinations := make([]any, len(columns))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return PreviewResult{}, fmt.Errorf("scan preview row: %w", err)
		}
		row := make([]any, len(values))
		for index, value := range values {
			if value.Valid {
				row[index] = value.String
			}
		}
		previewRows = append(previewRows, row)
	}
	if err := rows.Err(); err != nil {
		return PreviewResult{}, fmt.Errorf("iterate preview rows: %w", err)
	}

	return PreviewResult{
		DatasetID: datasetID,
		VersionID: versionID,
		Columns:   columns,
		Rows:      previewRows,
		Offset:    offset,
		Limit:     limit,
		TotalRows: totalRows,
	}, nil
}
