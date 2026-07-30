package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

func (service *Service) executeDataCleanPlan(ctx context.Context, plan DataCleanPlan) (derivedExecution, error) {
	execution, _, err := service.executeDataCleanPlanWithImpact(ctx, plan)
	return execution, err
}

func (service *Service) PreviewDataCleanPlan(ctx context.Context, plan DataCleanPlan, policy DataCleanQualityPolicy) (DataCleanReviewPreview, error) {
	if err := validateDataCleanPlan(plan); err != nil {
		return DataCleanReviewPreview{}, err
	}
	if err := validateDataCleanQualityPolicy(&policy, plan); err != nil {
		return DataCleanReviewPreview{}, err
	}
	execution, impact, err := service.executeDataCleanPlanWithImpact(ctx, plan)
	if err != nil {
		return DataCleanReviewPreview{}, err
	}
	_, fingerprint, err := derivedPlanEvidence(DerivedTransformationPlan{Kind: "data-clean", CleanPlan: &plan})
	if err != nil {
		return DataCleanReviewPreview{}, err
	}
	impact.PlanFingerprint = fingerprint
	quality, err := service.evaluateDataCleanQuality(ctx, plan, execution, policy)
	if err != nil {
		return DataCleanReviewPreview{}, err
	}
	return DataCleanReviewPreview{Impact: impact, Quality: quality}, nil
}

func (service *Service) executeDataCleanPlanWithImpact(ctx context.Context, plan DataCleanPlan) (derivedExecution, DataCleanImpactPreview, error) {
	tables := make([]cleanTable, len(plan.Sources))
	parents := make([]DerivedLineageParent, len(plan.Sources))
	sources := make([]DataCleanImpactSource, len(plan.Sources))
	for index, source := range plan.Sources {
		table, parent, err := service.loadCleanSource(ctx, source, index)
		if err != nil {
			return derivedExecution{}, DataCleanImpactPreview{}, err
		}
		tables[index], parents[index] = table, parent
		sources[index] = DataCleanImpactSource{DatasetID: source.DatasetID, VersionID: source.VersionID, DisplayName: parent.DisplayName, RowCount: len(table.rows), Columns: append([]string(nil), table.columns...)}
	}
	current := tables[0]
	operationImpacts := make([]DataCleanOperationImpact, 0, len(plan.Operations))
	for index, operation := range plan.Operations {
		if err := ctx.Err(); err != nil {
			return derivedExecution{}, DataCleanImpactPreview{}, err
		}
		beforeRows, beforeColumns := len(current.rows), len(current.columns)
		next, err := applyDataCleanOperation(ctx, current, tables, operation)
		if err != nil {
			return derivedExecution{}, DataCleanImpactPreview{}, fmt.Errorf("data-clean operation %d (%s): %w", index+1, operation.Kind, err)
		}
		if err := validateCleanTableBudget(ctx, next); err != nil {
			return derivedExecution{}, DataCleanImpactPreview{}, fmt.Errorf("data-clean operation %d (%s): %w", index+1, operation.Kind, err)
		}
		operationImpacts = append(operationImpacts, DataCleanOperationImpact{Ordinal: index + 1, Kind: operation.Kind, BeforeRowCount: beforeRows, AfterRowCount: len(next.rows), BeforeColumnCount: beforeColumns, AfterColumnCount: len(next.columns)})
		operationImpacts[len(operationImpacts)-1].BeforeColumns = append([]string(nil), current.columns...)
		operationImpacts[len(operationImpacts)-1].AfterColumns = append([]string(nil), next.columns...)
		operationImpacts[len(operationImpacts)-1].AffectedRowCount = cleanAffectedRows(current, next)
		current = next
	}
	columns := make([]QueryResultColumn, len(current.columns))
	for index, column := range current.columns {
		columns[index] = QueryResultColumn{Label: column, Type: ColumnTypeText}
	}
	rows := make([][]any, len(current.rows))
	for rowIndex, row := range current.rows {
		values := make([]any, len(row))
		for columnIndex, value := range row {
			if value != nil {
				values[columnIndex] = *value
			}
		}
		rows[rowIndex] = values
	}
	impact := DataCleanImpactPreview{
		Sources: sources, ResultRowCount: len(current.rows), ResultColumns: append([]string(nil), current.columns...), Operations: operationImpacts,
	}
	execution := derivedExecution{columns: columns, rows: rows, parents: parents, purpose: plan.Purpose, cleanImpact: &impact}
	return execution, impact, nil
}

func cleanAffectedRows(before, after cleanTable) int {
	if len(before.rows) != len(after.rows) || len(before.columns) != len(after.columns) {
		if len(before.rows) > len(after.rows) {
			return len(before.rows) - len(after.rows)
		}
		if len(after.rows) > len(before.rows) {
			return len(after.rows) - len(before.rows)
		}
		return len(after.rows)
	}
	for index := range before.columns {
		if before.columns[index] != after.columns[index] {
			return len(after.rows)
		}
	}
	affected := 0
	for rowIndex := range before.rows {
		changed := false
		for columnIndex := range before.rows[rowIndex] {
			left, right := before.rows[rowIndex][columnIndex], after.rows[rowIndex][columnIndex]
			if (left == nil) != (right == nil) || (left != nil && right != nil && *left != *right) {
				changed = true
				break
			}
		}
		if changed {
			affected++
		}
	}
	return affected
}

func (service *Service) loadCleanSource(ctx context.Context, source DataCleanSource, ordinal int) (cleanTable, DerivedLineageParent, error) {
	var tableName, currentVersionID, displayName string
	var rowCount int
	err := service.database.QueryRowContext(ctx, `
SELECT v.table_name, d.current_version_id, d.display_name, v.row_count
FROM datasets d JOIN dataset_versions v ON v.id = ? AND v.dataset_id = d.id
WHERE d.id = ? AND v.status = 'ready'`, source.VersionID, source.DatasetID).Scan(&tableName, &currentVersionID, &displayName, &rowCount)
	if errors.Is(err, sql.ErrNoRows) {
		return cleanTable{}, DerivedLineageParent{}, errors.New("data-clean source version was not found")
	}
	if err != nil {
		return cleanTable{}, DerivedLineageParent{}, fmt.Errorf("load data-clean source: %w", err)
	}
	if currentVersionID != source.VersionID {
		return cleanTable{}, DerivedLineageParent{}, errors.New("data-clean plan targets a stale source version")
	}
	if !internalTableName.MatchString(tableName) || rowCount > maximumCleanRows {
		return cleanTable{}, DerivedLineageParent{}, errors.New("data-clean source exceeds the execution boundary")
	}
	profiles, physicalNames, err := service.loadColumns(ctx, source.VersionID)
	if err != nil {
		return cleanTable{}, DerivedLineageParent{}, err
	}
	columns := make([]string, len(profiles))
	for index, profile := range profiles {
		columns[index] = profile.Name
	}
	if len(columns) == 0 || rowCount > maximumCleanCells/len(columns) {
		return cleanTable{}, DerivedLineageParent{}, errors.New("data-clean source exceeds the cell budget")
	}
	rows, err := service.database.QueryContext(ctx, "SELECT "+strings.Join(physicalNames, ", ")+" FROM "+tableName+" ORDER BY __row_number")
	if err != nil {
		return cleanTable{}, DerivedLineageParent{}, fmt.Errorf("read data-clean source: %w", err)
	}
	defer rows.Close()
	result := cleanTable{columns: columns, rows: make([][]*string, 0, rowCount)}
	totalBytes := 0
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return cleanTable{}, DerivedLineageParent{}, err
		}
		values := make([]sql.NullString, len(columns))
		destinations := make([]any, len(columns))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return cleanTable{}, DerivedLineageParent{}, fmt.Errorf("scan data-clean source: %w", err)
		}
		row := make([]*string, len(values))
		for index, value := range values {
			if value.Valid {
				text := value.String
				totalBytes += len(text)
				row[index] = &text
			}
		}
		if totalBytes > maximumCleanBytes {
			return cleanTable{}, DerivedLineageParent{}, errors.New("data-clean source exceeds the memory budget")
		}
		result.rows = append(result.rows, row)
	}
	if err := rows.Err(); err != nil {
		return cleanTable{}, DerivedLineageParent{}, fmt.Errorf("iterate data-clean source: %w", err)
	}
	return result, DerivedLineageParent{Ordinal: ordinal, DatasetID: source.DatasetID, VersionID: source.VersionID, DisplayName: displayName}, nil
}

func validateCleanTableBudget(ctx context.Context, table cleanTable) error {
	if len(table.rows) > maximumCleanRows || len(table.columns) == 0 || len(table.columns) > 256 || len(table.rows) > maximumCleanCells/len(table.columns) {
		return errors.New("data-clean result exceeds its row, column, or cell budget")
	}
	totalBytes := 0
	for rowIndex, row := range table.rows {
		if rowIndex%1024 == 0 {
			if err := ctx.Err(); err != nil {
				return err
			}
		}
		for _, value := range row {
			if value != nil {
				totalBytes += len(*value)
			}
		}
		if totalBytes > maximumCleanBytes {
			return errors.New("data-clean result exceeds the memory budget")
		}
	}
	return nil
}

func (service *Service) rebindDataCleanPlan(ctx context.Context, plan *DataCleanPlan) error {
	for index := range plan.Sources {
		var versionID string
		if err := service.database.QueryRowContext(ctx, "SELECT current_version_id FROM datasets WHERE id = ?", plan.Sources[index].DatasetID).Scan(&versionID); err != nil {
			return fmt.Errorf("rebind data-clean source %d: %w", index+1, err)
		}
		plan.Sources[index].VersionID = versionID
	}
	return nil
}
