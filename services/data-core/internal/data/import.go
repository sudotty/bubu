package data

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxImportFiles = 100

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
	absolutePath, err := filepath.Abs(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("resolve source path: %w", err)
	}
	info, err := os.Stat(absolutePath)
	if err != nil {
		return nil, fmt.Errorf("inspect source file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("source must be a regular file")
	}
	hash, err := hashFile(absolutePath)
	if err != nil {
		return nil, err
	}
	source, err := openTabularSource(absolutePath)
	if err != nil {
		return nil, err
	}
	closed := false
	defer func() {
		if !closed {
			_ = source.close()
		}
	}()
	if len(source.tables) == 0 {
		return nil, errors.New("source contains no non-empty tables")
	}

	result := make([]DatasetSummary, 0, len(source.tables))
	for _, table := range source.tables {
		dataset, importErr := importTable(ctx, transaction, source, table, hash, info.Size())
		if importErr != nil {
			return nil, importErr
		}
		result = append(result, dataset)
	}
	if err := source.close(); err != nil {
		return nil, fmt.Errorf("close source: %w", err)
	}
	closed = true
	return result, nil
}

func importTable(
	ctx context.Context,
	transaction *sql.Tx,
	source *tabularSource,
	table sourceTable,
	fileHash string,
	fileSize int64,
) (DatasetSummary, error) {
	if len(table.header) == 0 {
		return DatasetSummary{}, errors.New("table header is empty")
	}
	datasetID, err := newID()
	if err != nil {
		return DatasetSummary{}, err
	}
	versionID, err := newID()
	if err != nil {
		return DatasetSummary{}, err
	}
	tableName := "data_" + versionID
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

	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO datasets(id, display_name, source_kind, source_name, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`, datasetID, table.displayName, source.kind, source.name, now, now); err != nil {
		return DatasetSummary{}, fmt.Errorf("create dataset: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_versions(
    id, dataset_id, ordinal, table_name, source_sha256, source_size,
    imported_at, row_count, column_count, status
) VALUES (?, ?, 1, ?, ?, ?, ?, 0, ?, 'importing')`,
		versionID, datasetID, tableName, fileHash, fileSize, now, len(names)); err != nil {
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
		profile, err := profileColumn(ctx, transaction, tableName, physicalName, rowCount)
		if err != nil {
			return DatasetSummary{}, err
		}
		if _, err := transaction.ExecContext(ctx, `
INSERT INTO dataset_columns(
    version_id, ordinal, source_name, name, physical_name, inferred_type,
    nullable, null_count, distinct_count, min_value, max_value
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			versionID,
			index,
			table.header[index],
			names[index],
			physicalName,
			inferences[index].Type(),
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
UPDATE dataset_versions SET row_count = ?, status = 'ready' WHERE id = ?`, rowCount, versionID); err != nil {
		return DatasetSummary{}, fmt.Errorf("finish dataset version: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
UPDATE datasets SET current_version_id = ?, updated_at = ? WHERE id = ?`, versionID, now, datasetID); err != nil {
		return DatasetSummary{}, fmt.Errorf("activate dataset version: %w", err)
	}

	return DatasetSummary{
		ID:          datasetID,
		VersionID:   versionID,
		DisplayName: table.displayName,
		SourceKind:  source.kind,
		SourceName:  source.name,
		RowCount:    rowCount,
		ColumnCount: len(names),
		ImportedAt:  now,
		Version:     1,
	}, nil
}

func newID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open source for hashing: %w", err)
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("hash source file: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
