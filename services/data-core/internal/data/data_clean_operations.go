package data

import (
	"context"
	"errors"
	"fmt"
)

func applyDataCleanOperation(ctx context.Context, current cleanTable, sources []cleanTable, operation DataCleanOperation) (cleanTable, error) {
	switch operation.Kind {
	case "select":
		indexes, err := cleanColumnIndexes(current.columns, operation.Columns)
		if err != nil {
			return cleanTable{}, err
		}
		rows := make([][]*string, len(current.rows))
		for rowIndex, row := range current.rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			rows[rowIndex] = pickCleanCells(row, indexes)
		}
		return cleanTable{columns: append([]string(nil), operation.Columns...), rows: rows}, nil
	case "rename":
		index, err := cleanColumnIndex(current.columns, operation.Column)
		if err != nil {
			return cleanTable{}, err
		}
		if existing, _ := cleanColumnIndex(current.columns, operation.Name); existing >= 0 && existing != index {
			return cleanTable{}, fmt.Errorf("column %q already exists", operation.Name)
		}
		current.columns = append([]string(nil), current.columns...)
		current.columns[index] = operation.Name
		return current, nil
	case "cast":
		index, err := cleanColumnIndex(current.columns, operation.Column)
		if err != nil {
			return cleanTable{}, err
		}
		rows := cloneCleanRows(current.rows)
		for rowIndex, row := range rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			converted, err := castCleanCell(row[index], operation.To)
			if err != nil {
				if operation.OnInvalid == "null" {
					row[index] = nil
					continue
				}
				return cleanTable{}, fmt.Errorf("row %d column %q: %w", rowIndex+1, operation.Column, err)
			}
			row[index] = converted
		}
		return cleanTable{columns: current.columns, rows: rows}, nil
	case "replace":
		index, err := cleanColumnIndex(current.columns, operation.Column)
		if err != nil {
			return cleanTable{}, err
		}
		match, err := cleanScalarCell(operation.Match)
		if err != nil {
			return cleanTable{}, err
		}
		replacement, err := cleanScalarCell(operation.Replacement)
		if err != nil {
			return cleanTable{}, err
		}
		rows := cloneCleanRows(current.rows)
		for rowIndex, row := range rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			if cleanCellsEqual(row[index], match, operation.Mode) {
				row[index] = cloneCleanCell(replacement)
			}
		}
		return cleanTable{columns: current.columns, rows: rows}, nil
	case "derive":
		if index, _ := cleanColumnIndex(current.columns, operation.Name); index >= 0 {
			return cleanTable{}, fmt.Errorf("column %q already exists", operation.Name)
		}
		rows := make([][]*string, len(current.rows))
		for rowIndex, row := range current.rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			value, err := evaluateCleanExpression(current.columns, row, *operation.Expression)
			if err != nil {
				return cleanTable{}, fmt.Errorf("row %d: %w", rowIndex+1, err)
			}
			rows[rowIndex] = append(append([]*string(nil), row...), value)
		}
		return cleanTable{columns: append(append([]string(nil), current.columns...), operation.Name), rows: rows}, nil
	case "filter":
		index, err := cleanColumnIndex(current.columns, operation.Predicate.Column)
		if err != nil {
			return cleanTable{}, err
		}
		rows := make([][]*string, 0, len(current.rows))
		for rowIndex, row := range current.rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			keep, err := evaluateCleanPredicate(row[index], *operation.Predicate)
			if err != nil {
				return cleanTable{}, err
			}
			if keep {
				rows = append(rows, row)
			}
		}
		return cleanTable{columns: current.columns, rows: rows}, nil
	case "deduplicate":
		indexes, err := cleanColumnIndexes(current.columns, operation.Keys)
		if err != nil {
			return cleanTable{}, err
		}
		rows, err := deduplicateCleanRows(ctx, current.rows, indexes, operation.Keep)
		return cleanTable{columns: current.columns, rows: rows}, err
	case "fill-missing":
		index, err := cleanColumnIndex(current.columns, operation.Column)
		if err != nil {
			return cleanTable{}, err
		}
		var fill *string
		if operation.Fill.Strategy == "literal" {
			fill, err = cleanScalarCell(operation.Fill.Value)
		} else {
			fill, err = meanCleanCell(ctx, current.rows, index)
		}
		if err != nil {
			return cleanTable{}, err
		}
		rows := cloneCleanRows(current.rows)
		for rowIndex, row := range rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			if cleanCellMissing(row[index]) {
				row[index] = cloneCleanCell(fill)
			}
		}
		return cleanTable{columns: current.columns, rows: rows}, nil
	case "append":
		source := sources[operation.SourceIndex]
		if !equalStrings(current.columns, source.columns) {
			return cleanTable{}, errors.New("append requires an identical ordered schema")
		}
		return cleanTable{columns: current.columns, rows: append(append([][]*string(nil), current.rows...), source.rows...)}, nil
	case "union":
		source := sources[operation.SourceIndex]
		sourceIndexes := make([]int, len(operation.Mapping))
		targetIndexes := make([]int, len(operation.Mapping))
		for index, mapping := range operation.Mapping {
			var err error
			sourceIndexes[index], err = cleanColumnIndex(source.columns, mapping.Source)
			if err != nil {
				return cleanTable{}, err
			}
			targetIndexes[index], err = cleanColumnIndex(current.columns, mapping.Target)
			if err != nil {
				return cleanTable{}, err
			}
		}
		rows := append([][]*string(nil), current.rows...)
		for rowIndex, sourceRow := range source.rows {
			if err := cleanIterationContext(ctx, rowIndex); err != nil {
				return cleanTable{}, err
			}
			row := make([]*string, len(current.columns))
			for index := range sourceIndexes {
				row[targetIndexes[index]] = sourceRow[sourceIndexes[index]]
			}
			rows = append(rows, row)
		}
		return cleanTable{columns: current.columns, rows: rows}, nil
	default:
		return cleanTable{}, errors.New("unsupported data-clean operation")
	}
}

func cleanIterationContext(ctx context.Context, index int) error {
	if index%1024 == 0 {
		return ctx.Err()
	}
	return nil
}

func cleanColumnIndex(columns []string, name string) (int, error) {
	for index, column := range columns {
		if column == name {
			return index, nil
		}
	}
	return -1, fmt.Errorf("unknown data-clean column %q", name)
}

func cleanColumnIndexes(columns, names []string) ([]int, error) {
	indexes := make([]int, len(names))
	for index, name := range names {
		columnIndex, err := cleanColumnIndex(columns, name)
		if err != nil {
			return nil, err
		}
		indexes[index] = columnIndex
	}
	return indexes, nil
}

func pickCleanCells(row []*string, indexes []int) []*string {
	result := make([]*string, len(indexes))
	for index, sourceIndex := range indexes {
		result[index] = row[sourceIndex]
	}
	return result
}

func cloneCleanRows(rows [][]*string) [][]*string {
	result := make([][]*string, len(rows))
	for index, row := range rows {
		result[index] = append([]*string(nil), row...)
	}
	return result
}

func cloneCleanCell(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
