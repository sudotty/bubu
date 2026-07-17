package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"time"
)

type replacementTarget struct {
	datasetID        string
	displayName      string
	sourceKind       string
	sourceLocator    string
	currentVersionID string
	currentVersion   int
	columns          []string
}

func (service *Service) ReplaceFile(
	ctx context.Context,
	datasetID string,
	sourcePath string,
) (ReplacementResult, error) {
	target, err := service.loadReplacementTarget(ctx, datasetID)
	if err != nil {
		return ReplacementResult{}, err
	}
	prepared, err := prepareSource(sourcePath)
	if err != nil {
		return ReplacementResult{}, err
	}
	defer prepared.close()
	if prepared.source.kind != target.sourceKind {
		return ReplacementResult{}, fmt.Errorf(
			"replacement source kind %q does not match dataset source kind %q",
			prepared.source.kind,
			target.sourceKind,
		)
	}
	table, err := selectReplacementTable(prepared.source, target.sourceLocator)
	if err != nil {
		return ReplacementResult{}, err
	}
	drift := CompareSchemas(target.columns, NormalizeHeaders(table.header))
	if !slices.Equal(drift.CurrentColumns, drift.IncomingColumns) {
		return ReplacementResult{Status: ReplacementMappingRequired, Drift: &drift}, nil
	}
	return service.materializeReplacement(ctx, target, prepared, table)
}

func (service *Service) materializeReplacement(
	ctx context.Context,
	target replacementTarget,
	prepared *preparedSource,
	table sourceTable,
) (ReplacementResult, error) {
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return ReplacementResult{}, fmt.Errorf("begin replacement: %w", err)
	}
	defer transaction.Rollback()
	if err := ensureCurrentVersion(ctx, transaction, target.datasetID, target.currentVersionID); err != nil {
		return ReplacementResult{}, err
	}
	versionID, err := newID()
	if err != nil {
		return ReplacementResult{}, err
	}
	version := versionTarget{
		datasetID:   target.datasetID,
		versionID:   versionID,
		version:     target.currentVersion + 1,
		displayName: target.displayName,
		sourceKind:  prepared.source.kind,
		sourceName:  prepared.source.name,
		importedAt:  time.Now().UTC().Format(time.RFC3339Nano),
	}
	dataset, err := materializeVersion(
		ctx,
		transaction,
		version,
		table,
		prepared.hash,
		prepared.size,
	)
	if err != nil {
		return ReplacementResult{}, err
	}
	if err := activateVersion(ctx, transaction, version, table.sheetName); err != nil {
		return ReplacementResult{}, err
	}
	if err := transaction.Commit(); err != nil {
		return ReplacementResult{}, fmt.Errorf("commit replacement: %w", err)
	}
	return ReplacementResult{Status: ReplacementApplied, Dataset: &dataset}, nil
}

func (service *Service) loadReplacementTarget(ctx context.Context, datasetID string) (replacementTarget, error) {
	if !objectID.MatchString(datasetID) {
		return replacementTarget{}, errors.New("dataset id is invalid")
	}
	var target replacementTarget
	err := service.database.QueryRowContext(ctx, `
SELECT d.id, d.display_name, d.source_kind, d.source_locator, v.id, v.ordinal
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, datasetID).Scan(
		&target.datasetID,
		&target.displayName,
		&target.sourceKind,
		&target.sourceLocator,
		&target.currentVersionID,
		&target.currentVersion,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return replacementTarget{}, errors.New("dataset not found")
	}
	if err != nil {
		return replacementTarget{}, fmt.Errorf("load replacement target: %w", err)
	}
	columns, _, err := service.loadColumns(ctx, target.currentVersionID)
	if err != nil {
		return replacementTarget{}, err
	}
	target.columns = make([]string, len(columns))
	for index, column := range columns {
		target.columns[index] = column.Name
	}
	return target, nil
}

func selectReplacementTable(source *tabularSource, sourceLocator string) (sourceTable, error) {
	if source.kind == "csv" {
		return source.tables[0], nil
	}
	if sourceLocator == "" {
		return sourceTable{}, errors.New("workbook dataset is missing its worksheet locator")
	}
	for _, table := range source.tables {
		if table.sheetName == sourceLocator {
			return table, nil
		}
	}
	return sourceTable{}, fmt.Errorf("replacement workbook is missing worksheet %q", sourceLocator)
}

func CompareSchemas(current, incoming []string) SchemaDrift {
	currentSet := make(map[string]struct{}, len(current))
	incomingSet := make(map[string]struct{}, len(incoming))
	for _, column := range current {
		currentSet[column] = struct{}{}
	}
	for _, column := range incoming {
		incomingSet[column] = struct{}{}
	}
	missing := make([]string, 0)
	for _, column := range current {
		if _, exists := incomingSet[column]; !exists {
			missing = append(missing, column)
		}
	}
	added := make([]string, 0)
	for _, column := range incoming {
		if _, exists := currentSet[column]; !exists {
			added = append(added, column)
		}
	}
	return SchemaDrift{
		CurrentColumns:  slices.Clone(current),
		IncomingColumns: slices.Clone(incoming),
		MissingColumns:  missing,
		AddedColumns:    added,
		Reordered:       len(missing) == 0 && len(added) == 0 && !slices.Equal(current, incoming),
	}
}

func ensureCurrentVersion(
	ctx context.Context,
	transaction *sql.Tx,
	datasetID string,
	expectedVersionID string,
) error {
	var currentVersionID string
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT current_version_id FROM datasets WHERE id = ?",
		datasetID,
	).Scan(&currentVersionID); err != nil {
		return fmt.Errorf("recheck current version: %w", err)
	}
	if currentVersionID != expectedVersionID {
		return errors.New("dataset changed while replacement was being prepared; retry the operation")
	}
	return nil
}
