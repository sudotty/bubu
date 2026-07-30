package data

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const (
	maximumExplicitDisclosureRows         = 20
	maximumExplicitDisclosureColumns      = 16
	maximumExplicitDisclosureCellBytes    = 4_000
	maximumExplicitDisclosurePayloadBytes = 64 * 1024
)

type ExplicitRowDisclosureSelection struct {
	SchemaVersion int      `json:"schemaVersion"`
	DatasetID     string   `json:"datasetId"`
	VersionID     string   `json:"versionId"`
	Purpose       string   `json:"purpose"`
	RowNumbers    []int64  `json:"rowNumbers"`
	Columns       []string `json:"columns"`
}

type ExplicitRowDisclosureRow struct {
	RowNumber int64 `json:"rowNumber"`
	Cells     []any `json:"cells"`
}

type ExplicitRowDisclosurePreview struct {
	SchemaVersion int                            `json:"schemaVersion"`
	Selection     ExplicitRowDisclosureSelection `json:"selection"`
	ColumnTypes   []ColumnType                   `json:"columnTypes"`
	Rows          []ExplicitRowDisclosureRow     `json:"rows"`
	CellCount     int                            `json:"cellCount"`
	PayloadBytes  int                            `json:"payloadBytes"`
	PayloadSHA256 string                         `json:"payloadSha256"`
}

type explicitRowDisclosurePayload struct {
	SchemaVersion int                            `json:"schemaVersion"`
	Selection     ExplicitRowDisclosureSelection `json:"selection"`
	ColumnTypes   []ColumnType                   `json:"columnTypes"`
	Rows          []ExplicitRowDisclosureRow     `json:"rows"`
}

func validateExplicitRowDisclosureSelection(selection ExplicitRowDisclosureSelection) error {
	if selection.SchemaVersion != 1 || !objectID.MatchString(selection.DatasetID) || !objectID.MatchString(selection.VersionID) {
		return errors.New("explicit row disclosure identity is invalid")
	}
	purpose := strings.TrimSpace(selection.Purpose)
	if purpose == "" || len([]byte(purpose)) > 500 {
		return errors.New("explicit row disclosure purpose is invalid")
	}
	if len(selection.RowNumbers) < 1 || len(selection.RowNumbers) > maximumExplicitDisclosureRows ||
		len(selection.Columns) < 1 || len(selection.Columns) > maximumExplicitDisclosureColumns {
		return errors.New("explicit row disclosure selection exceeds its budget")
	}
	seenRows := make(map[int64]bool, len(selection.RowNumbers))
	for _, rowNumber := range selection.RowNumbers {
		if rowNumber < 1 || seenRows[rowNumber] {
			return errors.New("explicit row numbers must be positive and unique")
		}
		seenRows[rowNumber] = true
	}
	seenColumns := make(map[string]bool, len(selection.Columns))
	for _, column := range selection.Columns {
		if strings.TrimSpace(column) == "" || column == "*" || len([]byte(column)) > 500 || seenColumns[column] {
			return errors.New("explicit row columns must be exact and unique")
		}
		seenColumns[column] = true
	}
	return nil
}

func (service *Service) PreviewExplicitRowDisclosure(ctx context.Context, selection ExplicitRowDisclosureSelection) (ExplicitRowDisclosurePreview, error) {
	if err := validateExplicitRowDisclosureSelection(selection); err != nil {
		return ExplicitRowDisclosurePreview{}, err
	}
	var tableName string
	err := service.database.QueryRowContext(ctx, `
SELECT v.table_name
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.id = ? AND v.status = 'ready'`, selection.DatasetID, selection.VersionID).Scan(&tableName)
	if errors.Is(err, sql.ErrNoRows) {
		return ExplicitRowDisclosurePreview{}, errors.New("explicit row disclosure requires the current ready dataset version")
	}
	if err != nil {
		return ExplicitRowDisclosurePreview{}, fmt.Errorf("load explicit row disclosure source: %w", err)
	}
	if !internalTableName.MatchString(tableName) {
		return ExplicitRowDisclosurePreview{}, errors.New("stored table name failed validation")
	}
	profiles, physicalNames, err := service.loadColumns(ctx, selection.VersionID)
	if err != nil {
		return ExplicitRowDisclosurePreview{}, err
	}
	physicalByName := make(map[string]string, len(profiles))
	typeByName := make(map[string]ColumnType, len(profiles))
	for index, profile := range profiles {
		physicalByName[profile.Name] = physicalNames[index]
		typeByName[profile.Name] = profile.InferredType
	}
	selectedPhysical := make([]string, len(selection.Columns))
	selectedTypes := make([]ColumnType, len(selection.Columns))
	for index, column := range selection.Columns {
		physical, ok := physicalByName[column]
		if !ok {
			return ExplicitRowDisclosurePreview{}, fmt.Errorf("selected column %q does not exist in the approved version", column)
		}
		selectedPhysical[index] = physical
		selectedTypes[index] = typeByName[column]
	}
	query := fmt.Sprintf("SELECT %s FROM %s WHERE __row_number = ?", strings.Join(selectedPhysical, ", "), tableName)
	statement, err := service.database.PrepareContext(ctx, query)
	if err != nil {
		return ExplicitRowDisclosurePreview{}, fmt.Errorf("prepare explicit row disclosure: %w", err)
	}
	defer statement.Close()
	resultRows := make([]ExplicitRowDisclosureRow, 0, len(selection.RowNumbers))
	for _, rowNumber := range selection.RowNumbers {
		values := make([]sql.NullString, len(selection.Columns))
		destinations := make([]any, len(values))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := statement.QueryRowContext(ctx, rowNumber).Scan(destinations...); errors.Is(err, sql.ErrNoRows) {
			return ExplicitRowDisclosurePreview{}, fmt.Errorf("selected row %d does not exist in the approved version", rowNumber)
		} else if err != nil {
			return ExplicitRowDisclosurePreview{}, fmt.Errorf("read selected row %d: %w", rowNumber, err)
		}
		cells := make([]any, len(values))
		for index, value := range values {
			if !value.Valid {
				continue
			}
			if len([]byte(value.String)) > maximumExplicitDisclosureCellBytes {
				return ExplicitRowDisclosurePreview{}, fmt.Errorf("selected cell at row %d exceeds the disclosure budget", rowNumber)
			}
			cells[index] = value.String
		}
		resultRows = append(resultRows, ExplicitRowDisclosureRow{RowNumber: rowNumber, Cells: cells})
	}
	payload := explicitRowDisclosurePayload{SchemaVersion: 1, Selection: selection, ColumnTypes: selectedTypes, Rows: resultRows}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return ExplicitRowDisclosurePreview{}, fmt.Errorf("encode explicit row disclosure: %w", err)
	}
	if len(encoded) > maximumExplicitDisclosurePayloadBytes {
		return ExplicitRowDisclosurePreview{}, errors.New("explicit row disclosure exceeds its 64 KiB payload budget")
	}
	digest := sha256.Sum256(encoded)
	return ExplicitRowDisclosurePreview{
		SchemaVersion: 1,
		Selection:     selection,
		ColumnTypes:   selectedTypes,
		Rows:          resultRows,
		CellCount:     len(resultRows) * len(selection.Columns),
		PayloadBytes:  len(encoded),
		PayloadSHA256: hex.EncodeToString(digest[:]),
	}, nil
}
