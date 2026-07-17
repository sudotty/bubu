package data

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

const maxImportFiles = 100
const maximumDatasetColumns = 500

func (service *Service) ImportFile(ctx context.Context, sourcePath string) (ImportResult, error) {
	return service.ImportFiles(ctx, []string{sourcePath})
}

func (service *Service) ImportFiles(ctx context.Context, sourcePaths []string) (ImportResult, error) {
	if len(sourcePaths) == 0 {
		return ImportResult{}, errors.New("at least one source file is required")
	}
	if len(sourcePaths) > maxImportFiles {
		return ImportResult{}, fmt.Errorf("cannot import more than %d files at once", maxImportFiles)
	}

	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ImportResult{}, fmt.Errorf("begin import: %w", err)
	}
	defer transaction.Rollback()

	result := ImportResult{Datasets: make([]DatasetSummary, 0, len(sourcePaths))}
	for _, sourcePath := range sourcePaths {
		datasets, err := importSource(ctx, transaction, sourcePath)
		if err != nil {
			return ImportResult{}, err
		}
		result.Datasets = append(result.Datasets, datasets...)
	}
	if err := transaction.Commit(); err != nil {
		return ImportResult{}, fmt.Errorf("commit import: %w", err)
	}
	return result, nil
}

func importSource(ctx context.Context, transaction *sql.Tx, sourcePath string) ([]DatasetSummary, error) {
	prepared, err := prepareSource(sourcePath)
	if err != nil {
		return nil, err
	}
	defer prepared.close()

	result := make([]DatasetSummary, 0, len(prepared.source.tables))
	for _, table := range prepared.source.tables {
		dataset, importErr := importTable(
			ctx,
			transaction,
			prepared.source,
			table,
			prepared.hash,
			prepared.size,
		)
		if importErr != nil {
			return nil, importErr
		}
		result = append(result, dataset)
	}
	if err := prepared.close(); err != nil {
		return nil, fmt.Errorf("close source: %w", err)
	}
	return result, nil
}

type versionTarget struct {
	datasetID   string
	versionID   string
	version     int
	displayName string
	sourceKind  string
	sourceName  string
	importedAt  string
}

func importTable(
	ctx context.Context,
	transaction *sql.Tx,
	source *tabularSource,
	table sourceTable,
	fileHash string,
	fileSize int64,
) (DatasetSummary, error) {
	datasetID, err := newID()
	if err != nil {
		return DatasetSummary{}, err
	}
	versionID, err := newID()
	if err != nil {
		return DatasetSummary{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO datasets(
    id, display_name, source_kind, source_name, source_locator, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		datasetID, table.displayName, source.kind, source.name, table.sheetName, now, now); err != nil {
		return DatasetSummary{}, fmt.Errorf("create dataset: %w", err)
	}
	target := versionTarget{
		datasetID:   datasetID,
		versionID:   versionID,
		version:     1,
		displayName: table.displayName,
		sourceKind:  source.kind,
		sourceName:  source.name,
		importedAt:  now,
	}
	dataset, err := materializeVersion(ctx, transaction, target, table, fileHash, fileSize)
	if err != nil {
		return DatasetSummary{}, err
	}
	if err := activateVersion(ctx, transaction, target, table.sheetName); err != nil {
		return DatasetSummary{}, err
	}
	return dataset, nil
}

func materializeVersion(
	ctx context.Context,
	transaction *sql.Tx,
	target versionTarget,
	table sourceTable,
	fileHash string,
	fileSize int64,
) (DatasetSummary, error) {
	if len(table.header) == 0 {
		return DatasetSummary{}, errors.New("table header is empty")
	}
	if len(table.header) > maximumDatasetColumns {
		return DatasetSummary{}, fmt.Errorf("table has %d columns; maximum is %d", len(table.header), maximumDatasetColumns)
	}
	tableName := "data_" + target.versionID
	if !internalTableName.MatchString(tableName) {
		return DatasetSummary{}, errors.New("generated table name is invalid")
	}
	names := NormalizeHeaders(table.header)
	physicalNames := make([]string, len(names))
	columnDefinitions := make([]string, len(names))
	for index := range names {
		physicalNames[index] = fmt.Sprintf("c%d", index)
		columnDefinitions[index] = physicalNames[index] + " TEXT"
	}
	createTableSQL := fmt.Sprintf(
		"CREATE TABLE %s (__row_number INTEGER PRIMARY KEY, %s)",
		tableName,
		strings.Join(columnDefinitions, ", "),
	)
	if _, err := transaction.ExecContext(ctx, createTableSQL); err != nil {
		return DatasetSummary{}, fmt.Errorf("create local data table: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_versions(
    id, dataset_id, ordinal, table_name, source_sha256, source_size,
    imported_at, row_count, column_count, status
) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'importing')`,
		target.versionID,
		target.datasetID,
		target.version,
		tableName,
		fileHash,
		fileSize,
		target.importedAt,
		len(names),
	); err != nil {
		return DatasetSummary{}, fmt.Errorf("create dataset version: %w", err)
	}

	placeholders := make([]string, len(names)+1)
	for index := range placeholders {
		placeholders[index] = "?"
	}
	insertSQL := fmt.Sprintf(
		"INSERT INTO %s(__row_number, %s) VALUES (%s)",
		tableName,
		strings.Join(physicalNames, ", "),
		strings.Join(placeholders, ", "),
	)
	statement, err := transaction.PrepareContext(ctx, insertSQL)
	if err != nil {
		return DatasetSummary{}, fmt.Errorf("prepare row insert: %w", err)
	}
	defer statement.Close()

	inferences := make([]TypeInference, len(names))
	for index := range inferences {
		inferences[index] = NewTypeInference()
	}
	var rowCount int64
	err = table.walkRows(ctx, func(row []string) error {
		if len(row) > len(names) {
			return fmt.Errorf("row has %d fields but header has %d", len(row), len(names))
		}
		rowCount++
		values := make([]any, len(names)+1)
		values[0] = rowCount
		for index := range names {
			value := ""
			if index < len(row) {
				value = row[index]
			}
			inferences[index] = inferences[index].Observe(value)
			if strings.TrimSpace(value) == "" {
				values[index+1] = nil
			} else {
				values[index+1] = value
			}
		}
		if _, err := statement.ExecContext(ctx, values...); err != nil {
			return fmt.Errorf("insert row: %w", err)
		}
		return nil
	})
	if err != nil {
		return DatasetSummary{}, err
	}
	if err := statement.Close(); err != nil {
		return DatasetSummary{}, fmt.Errorf("finish row insert: %w", err)
	}

	for index, physicalName := range physicalNames {
		inferredType := inferences[index].Type()
		profile, err := profileColumn(ctx, transaction, tableName, physicalName, inferredType, rowCount)
		if err != nil {
			return DatasetSummary{}, err
		}
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_columns(
    version_id, ordinal, source_name, name, physical_name, inferred_type,
    nullable, null_count, distinct_count, min_value, max_value
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			target.versionID,
			index,
			table.header[index],
			names[index],
			physicalName,
			inferredType,
			profile.nullable,
			profile.nullCount,
			profile.distinctCount,
			profile.minValue,
			profile.maxValue,
		); err != nil {
			return DatasetSummary{}, fmt.Errorf("store column profile: %w", err)
		}
	}

	if _, err := transaction.ExecContext(ctx, `
UPDATE dataset_versions SET row_count = ?, status = 'ready' WHERE id = ?`, rowCount, target.versionID); err != nil {
		return DatasetSummary{}, fmt.Errorf("finish dataset version: %w", err)
	}
	return DatasetSummary{
		ID:          target.datasetID,
		VersionID:   target.versionID,
		DisplayName: target.displayName,
		SourceKind:  target.sourceKind,
		SourceName:  target.sourceName,
		RowCount:    rowCount,
		ColumnCount: len(names),
		ImportedAt:  target.importedAt,
		Version:     target.version,
	}, nil
}

func activateVersion(
	ctx context.Context,
	transaction *sql.Tx,
	target versionTarget,
	sourceLocator string,
) error {
	if _, err := transaction.ExecContext(ctx, `
UPDATE datasets
SET current_version_id = ?, source_name = ?, source_locator = ?, updated_at = ?
WHERE id = ?`,
		target.versionID,
		target.sourceName,
		sourceLocator,
		target.importedAt,
		target.datasetID,
	); err != nil {
		return fmt.Errorf("activate dataset version: %w", err)
	}
	return nil
}

func newID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
