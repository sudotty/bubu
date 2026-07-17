package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

type queryColumn struct {
	profile  ColumnProfile
	physical string
}

type compiledQuery struct {
	sql     string
	args    []any
	columns []QueryResultColumn
}

func (service *Service) ExecuteQueryPlan(ctx context.Context, plan SafeQueryPlan) (SafeQueryResult, error) {
	if err := validateQueryPlanShape(plan); err != nil {
		return SafeQueryResult{}, err
	}
	var tableName string
	var currentVersionID string
	err := service.database.QueryRowContext(ctx, `
SELECT v.id, v.table_name
FROM datasets d
JOIN dataset_versions v ON v.id = d.current_version_id
WHERE d.id = ? AND v.status = 'ready'`, plan.DatasetID).Scan(&currentVersionID, &tableName)
	if errors.Is(err, sql.ErrNoRows) {
		return SafeQueryResult{}, errors.New("dataset not found")
	}
	if err != nil {
		return SafeQueryResult{}, fmt.Errorf("load query dataset: %w", err)
	}
	if currentVersionID != plan.VersionID {
		return SafeQueryResult{}, errors.New("query plan targets a stale dataset version")
	}
	if !internalTableName.MatchString(tableName) {
		return SafeQueryResult{}, errors.New("stored table name failed validation")
	}

	profiles, physicalNames, err := service.loadColumns(ctx, currentVersionID)
	if err != nil {
		return SafeQueryResult{}, err
	}
	columns := make(map[string]queryColumn, len(profiles))
	for index, profile := range profiles {
		columns[profile.Name] = queryColumn{profile: profile, physical: physicalNames[index]}
	}
	compiled, err := compileSafeQuery(plan, tableName, columns)
	if err != nil {
		return SafeQueryResult{}, err
	}
	rows, err := service.database.QueryContext(ctx, compiled.sql, compiled.args...)
	if err != nil {
		return SafeQueryResult{}, fmt.Errorf("execute safe query: %w", err)
	}
	defer rows.Close()
	resultRows := make([][]any, 0, plan.Limit)
	for rows.Next() {
		values := make([]any, len(compiled.columns))
		destinations := make([]any, len(values))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return SafeQueryResult{}, fmt.Errorf("scan safe query result: %w", err)
		}
		if len(resultRows) == plan.Limit {
			return SafeQueryResult{
				DatasetID: plan.DatasetID, VersionID: plan.VersionID,
				Columns: compiled.columns, Rows: resultRows, Truncated: true,
			}, nil
		}
		resultRows = append(resultRows, normalizeQueryRow(values))
	}
	if err := rows.Err(); err != nil {
		return SafeQueryResult{}, fmt.Errorf("iterate safe query result: %w", err)
	}
	return SafeQueryResult{
		DatasetID: plan.DatasetID, VersionID: plan.VersionID,
		Columns: compiled.columns, Rows: resultRows, Truncated: false,
	}, nil
}

func validateQueryPlanShape(plan SafeQueryPlan) error {
	if plan.SchemaVersion != 1 {
		return errors.New("unsupported query plan version")
	}
	if !objectID.MatchString(plan.DatasetID) || !objectID.MatchString(plan.VersionID) {
		return errors.New("query plan dataset identity is invalid")
	}
	if strings.TrimSpace(plan.Purpose) == "" || len(plan.Purpose) > 500 {
		return errors.New("query plan purpose is invalid")
	}
	if plan.Dimensions == nil || plan.Measures == nil || plan.Filters == nil || plan.Sort == nil {
		return errors.New("query plan arrays must be explicit")
	}
	if len(plan.Dimensions)+len(plan.Measures) == 0 || len(plan.Dimensions) > 8 || len(plan.Measures) > 8 {
		return errors.New("query plan output shape is invalid")
	}
	if len(plan.Filters) > 20 || len(plan.Sort) > 3 || plan.Limit < 1 || plan.Limit > 200 {
		return errors.New("query plan exceeds execution limits")
	}
	seen := make(map[string]bool, len(plan.Dimensions))
	for _, dimension := range plan.Dimensions {
		if strings.TrimSpace(dimension) == "" || len(dimension) > 500 || seen[dimension] {
			return errors.New("query dimensions are invalid or duplicated")
		}
		seen[dimension] = true
	}
	for _, measure := range plan.Measures {
		if measure.Column != nil && (strings.TrimSpace(*measure.Column) == "" || len(*measure.Column) > 500) {
			return errors.New("query measure column is invalid")
		}
	}
	for _, filter := range plan.Filters {
		if strings.TrimSpace(filter.Column) == "" || len(filter.Column) > 500 || (filter.Value != nil && len(*filter.Value) > 10000) {
			return errors.New("query filter is invalid")
		}
	}
	for _, sort := range plan.Sort {
		if sort.OutputIndex < 0 || sort.OutputIndex >= len(plan.Dimensions)+len(plan.Measures) {
			return errors.New("query sort target is invalid")
		}
		if sort.Direction != "ascending" && sort.Direction != "descending" {
			return errors.New("query sort direction is invalid")
		}
	}
	return nil
}

func compileSafeQuery(plan SafeQueryPlan, tableName string, available map[string]queryColumn) (compiledQuery, error) {
	selects := make([]string, 0, len(plan.Dimensions)+len(plan.Measures))
	resultColumns := make([]QueryResultColumn, 0, cap(selects))
	groups := make([]string, 0, len(plan.Dimensions))
	for _, name := range plan.Dimensions {
		column, ok := available[name]
		if !ok {
			return compiledQuery{}, fmt.Errorf("unknown query column %q", name)
		}
		selects = append(selects, column.physical)
		groups = append(groups, column.physical)
		resultColumns = append(resultColumns, QueryResultColumn{Label: name, Type: column.profile.InferredType})
	}
	for _, measure := range plan.Measures {
		expression, resultColumn, err := compileMeasure(measure, available)
		if err != nil {
			return compiledQuery{}, err
		}
		selects = append(selects, expression)
		resultColumns = append(resultColumns, resultColumn)
	}
	where, args, err := compileFilters(plan.Filters, available)
	if err != nil {
		return compiledQuery{}, err
	}
	parts := []string{"SELECT " + strings.Join(selects, ", "), "FROM " + tableName}
	if where != "" {
		parts = append(parts, "WHERE "+where)
	}
	if len(plan.Measures) > 0 && len(groups) > 0 {
		parts = append(parts, "GROUP BY "+strings.Join(groups, ", "))
	}
	if len(plan.Sort) > 0 {
		orders := make([]string, len(plan.Sort))
		for index, sort := range plan.Sort {
			direction := "ASC"
			if sort.Direction == "descending" {
				direction = "DESC"
			}
			orders[index] = fmt.Sprintf("%d %s", sort.OutputIndex+1, direction)
		}
		parts = append(parts, "ORDER BY "+strings.Join(orders, ", "))
	} else if len(plan.Measures) == 0 {
		parts = append(parts, "ORDER BY __row_number")
	}
	parts = append(parts, "LIMIT ?")
	args = append(args, plan.Limit+1)
	return compiledQuery{sql: strings.Join(parts, " "), args: args, columns: resultColumns}, nil
}

func compileMeasure(measure QueryMeasure, available map[string]queryColumn) (string, QueryResultColumn, error) {
	if measure.Operation == "count" && measure.Column == nil {
		return "COUNT(*)", QueryResultColumn{Label: "Count", Type: ColumnTypeInteger}, nil
	}
	if measure.Column == nil {
		return "", QueryResultColumn{}, errors.New("query measure column is required")
	}
	column, ok := available[*measure.Column]
	if !ok {
		return "", QueryResultColumn{}, fmt.Errorf("unknown query column %q", *measure.Column)
	}
	switch measure.Operation {
	case "count":
		return "COUNT(" + column.physical + ")", QueryResultColumn{Label: "Count of " + *measure.Column, Type: ColumnTypeInteger}, nil
	case "sum", "average":
		if column.profile.InferredType != ColumnTypeInteger && column.profile.InferredType != ColumnTypeReal {
			return "", QueryResultColumn{}, fmt.Errorf("%s requires a numeric column", measure.Operation)
		}
		function := "SUM"
		label := "Sum of "
		if measure.Operation == "average" {
			function = "AVG"
			label = "Average of "
		}
		return function + "(CAST(" + column.physical + " AS REAL))", QueryResultColumn{Label: label + *measure.Column, Type: ColumnTypeReal}, nil
	case "minimum", "maximum":
		function := "MIN"
		label := "Minimum of "
		if measure.Operation == "maximum" {
			function = "MAX"
			label = "Maximum of "
		}
		expression := column.physical
		if column.profile.InferredType == ColumnTypeInteger || column.profile.InferredType == ColumnTypeReal {
			expression = "CAST(" + expression + " AS REAL)"
		}
		return function + "(" + expression + ")", QueryResultColumn{Label: label + *measure.Column, Type: column.profile.InferredType}, nil
	default:
		return "", QueryResultColumn{}, errors.New("unsupported query measure")
	}
}

func compileFilters(filters []QueryFilter, available map[string]queryColumn) (string, []any, error) {
	predicates := make([]string, 0, len(filters))
	args := make([]any, 0, len(filters))
	for _, filter := range filters {
		column, ok := available[filter.Column]
		if !ok {
			return "", nil, fmt.Errorf("unknown query column %q", filter.Column)
		}
		switch filter.Operator {
		case "is-null", "is-not-null":
			if filter.Value != nil {
				return "", nil, errors.New("null filters cannot contain a value")
			}
			operator := "IS NULL"
			if filter.Operator == "is-not-null" {
				operator = "IS NOT NULL"
			}
			predicates = append(predicates, column.physical+" "+operator)
		case "contains":
			if filter.Value == nil {
				return "", nil, errors.New("query filter value is required")
			}
			predicates = append(predicates, "instr("+column.physical+", ?) > 0")
			args = append(args, *filter.Value)
		default:
			predicate, argument, err := compileComparison(filter, column)
			if err != nil {
				return "", nil, err
			}
			predicates = append(predicates, predicate)
			args = append(args, argument)
		}
	}
	return strings.Join(predicates, " AND "), args, nil
}

func compileComparison(filter QueryFilter, column queryColumn) (string, any, error) {
	if filter.Value == nil {
		return "", nil, errors.New("query filter value is required")
	}
	operators := map[string]string{
		"equals": "=", "not-equals": "!=", "greater-than": ">", "greater-or-equal": ">=", "less-than": "<", "less-or-equal": "<=",
	}
	operator, ok := operators[filter.Operator]
	if !ok {
		return "", nil, errors.New("unsupported query filter")
	}
	expression := column.physical
	argument := any(*filter.Value)
	if column.profile.InferredType == ColumnTypeInteger || column.profile.InferredType == ColumnTypeReal {
		number, err := strconv.ParseFloat(*filter.Value, 64)
		if err != nil {
			return "", nil, fmt.Errorf("numeric filter for %q is invalid", filter.Column)
		}
		expression = "CAST(" + column.physical + " AS REAL)"
		argument = number
	}
	return expression + " " + operator + " ?", argument, nil
}

func normalizeQueryRow(values []any) []any {
	result := make([]any, len(values))
	for index, value := range values {
		if bytes, ok := value.([]byte); ok {
			result[index] = string(bytes)
		} else {
			result[index] = value
		}
	}
	return result
}
