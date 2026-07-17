package data

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (service *Service) ExportDatasetCSV(
	ctx context.Context,
	datasetID string,
	targetPath string,
) (DatasetExportResult, error) {
	target, err := service.loadQualityTarget(ctx, datasetID)
	if err != nil {
		return DatasetExportResult{}, err
	}
	absolutePath, err := validateExportPath(targetPath)
	if err != nil {
		return DatasetExportResult{}, err
	}
	physicalNames := make([]string, len(target.columns))
	for index, column := range target.columns {
		physicalNames[index] = target.physicalByName[column.Name]
	}
	query := fmt.Sprintf(
		"SELECT %s FROM %s ORDER BY __row_number",
		strings.Join(physicalNames, ", "),
		target.tableName,
	)
	rows, err := service.database.QueryContext(ctx, query)
	if err != nil {
		return DatasetExportResult{}, fmt.Errorf("query dataset export: %w", err)
	}
	defer rows.Close()

	temporary, err := os.CreateTemp(filepath.Dir(absolutePath), ".bubu-export-*.csv")
	if err != nil {
		return DatasetExportResult{}, fmt.Errorf("create temporary export: %w", err)
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		if !committed {
			temporary.Close()
			os.Remove(temporaryPath)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return DatasetExportResult{}, fmt.Errorf("restrict temporary export: %w", err)
	}
	if _, err := temporary.Write([]byte{0xef, 0xbb, 0xbf}); err != nil {
		return DatasetExportResult{}, fmt.Errorf("write UTF-8 export marker: %w", err)
	}
	writer := csv.NewWriter(temporary)
	header := make([]string, len(target.columns))
	for index, column := range target.columns {
		header[index] = column.Name
	}
	if err := writer.Write(header); err != nil {
		return DatasetExportResult{}, fmt.Errorf("write export header: %w", err)
	}
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return DatasetExportResult{}, err
		}
		values := make([]sql.NullString, len(target.columns))
		destinations := make([]any, len(values))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return DatasetExportResult{}, fmt.Errorf("scan export row: %w", err)
		}
		record := make([]string, len(values))
		for index, value := range values {
			if value.Valid {
				record[index] = excelSafeCSVCell(value.String, target.columns[index].InferredType)
			}
		}
		if err := writer.Write(record); err != nil {
			return DatasetExportResult{}, fmt.Errorf("write export row: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return DatasetExportResult{}, fmt.Errorf("iterate export rows: %w", err)
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return DatasetExportResult{}, fmt.Errorf("flush export: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return DatasetExportResult{}, fmt.Errorf("sync export: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return DatasetExportResult{}, fmt.Errorf("close export: %w", err)
	}
	if err := os.Rename(temporaryPath, absolutePath); err != nil {
		return DatasetExportResult{}, fmt.Errorf("publish export: %w", err)
	}
	committed = true
	if err := os.Chmod(absolutePath, 0o600); err != nil {
		return DatasetExportResult{}, fmt.Errorf("restrict export: %w", err)
	}
	return DatasetExportResult{
		Status: "exported", DatasetID: datasetID, VersionID: target.versionID,
		FileName: filepath.Base(absolutePath), RowCount: target.rowCount, Mode: "excel-safe",
	}, nil
}

func validateExportPath(targetPath string) (string, error) {
	if strings.TrimSpace(targetPath) == "" {
		return "", errors.New("export path is required")
	}
	absolutePath, err := filepath.Abs(targetPath)
	if err != nil {
		return "", fmt.Errorf("resolve export path: %w", err)
	}
	if strings.ToLower(filepath.Ext(absolutePath)) != ".csv" {
		return "", errors.New("dataset export must use a .csv file")
	}
	directory, err := os.Stat(filepath.Dir(absolutePath))
	if err != nil {
		return "", fmt.Errorf("inspect export directory: %w", err)
	}
	if !directory.IsDir() {
		return "", errors.New("export destination is not a directory")
	}
	return absolutePath, nil
}

func excelSafeCSVCell(value string, inferredType ColumnType) string {
	if inferredType != ColumnTypeText {
		return value
	}
	trimmed := strings.TrimLeft(value, " \t\r\n")
	if trimmed == "" {
		return value
	}
	switch trimmed[0] {
	case '=', '+', '-', '@':
		return "'" + value
	default:
		return value
	}
}
