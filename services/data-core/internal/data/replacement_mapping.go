package data

import (
	"context"
	"errors"
	"fmt"
)

func (service *Service) ReplaceFileWithMapping(
	ctx context.Context,
	datasetID string,
	sourcePath string,
	mappings []ColumnMapping,
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
	mapped, err := mapReplacementTable(table, target.columns, mappings)
	if err != nil {
		return ReplacementResult{}, err
	}
	return service.materializeReplacement(ctx, target, prepared, mapped)
}

func mapReplacementTable(
	table sourceTable,
	currentColumns []string,
	mappings []ColumnMapping,
) (sourceTable, error) {
	if len(mappings) != len(currentColumns) {
		return sourceTable{}, errors.New("replacement mapping must map every current column exactly once")
	}
	currentSet := make(map[string]struct{}, len(currentColumns))
	for _, column := range currentColumns {
		currentSet[column] = struct{}{}
	}
	incomingColumns := NormalizeHeaders(table.header)
	incomingIndexes := make(map[string]int, len(incomingColumns))
	for index, column := range incomingColumns {
		incomingIndexes[column] = index
	}
	selectedIndexes := make(map[string]int, len(mappings))
	usedIncoming := make(map[string]struct{}, len(mappings))
	for _, mapping := range mappings {
		if _, exists := currentSet[mapping.CurrentColumn]; !exists {
			return sourceTable{}, fmt.Errorf("current column %q does not exist", mapping.CurrentColumn)
		}
		if _, exists := selectedIndexes[mapping.CurrentColumn]; exists {
			return sourceTable{}, fmt.Errorf("current column %q is mapped more than once", mapping.CurrentColumn)
		}
		incomingIndex, exists := incomingIndexes[mapping.IncomingColumn]
		if !exists {
			return sourceTable{}, fmt.Errorf("incoming column %q does not exist", mapping.IncomingColumn)
		}
		if _, exists := usedIncoming[mapping.IncomingColumn]; exists {
			return sourceTable{}, fmt.Errorf("incoming column %q is mapped more than once", mapping.IncomingColumn)
		}
		selectedIndexes[mapping.CurrentColumn] = incomingIndex
		usedIncoming[mapping.IncomingColumn] = struct{}{}
	}
	orderedIndexes := make([]int, len(currentColumns))
	for index, column := range currentColumns {
		incomingIndex, exists := selectedIndexes[column]
		if !exists {
			return sourceTable{}, fmt.Errorf("current column %q is not mapped", column)
		}
		orderedIndexes[index] = incomingIndex
	}

	return sourceTable{
		displayName: table.displayName,
		sheetName:   table.sheetName,
		header:      append([]string(nil), currentColumns...),
		walkRows: func(ctx context.Context, yield func([]string) error) error {
			return table.walkRows(ctx, func(incomingRow []string) error {
				mappedRow := make([]string, len(orderedIndexes))
				for index, incomingIndex := range orderedIndexes {
					if incomingIndex < len(incomingRow) {
						mappedRow[index] = incomingRow[incomingIndex]
					}
				}
				return yield(mappedRow)
			})
		},
	}, nil
}
