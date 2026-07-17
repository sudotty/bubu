package data

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

type groupQueryRuntimeSource struct {
	reference GroupQuerySource
	tableName string
	rowCount  int64
	columns   map[string]queryColumn
}

func (service *Service) ExecuteGroupQueryPlan(
	ctx context.Context,
	plan SafeGroupQueryPlan,
) (SafeGroupQueryResult, error) {
	if err := validateGroupQueryPlanShape(plan); err != nil {
		return SafeGroupQueryResult{}, err
	}
	group, err := service.GetGroup(ctx, plan.GroupID)
	if err != nil {
		return SafeGroupQueryResult{}, err
	}
	if len(group.Members) != len(plan.Sources) {
		return SafeGroupQueryResult{}, errors.New("group query sources do not match current membership")
	}
	runtimeSources := make([]groupQueryRuntimeSource, len(plan.Sources))
	for index, source := range plan.Sources {
		member := group.Members[index]
		if source.DatasetID != member.ID || source.VersionID != member.VersionID {
			return SafeGroupQueryResult{}, errors.New("group query targets stale or reordered members")
		}
		var tableName string
		if err := service.database.QueryRowContext(ctx, `
SELECT table_name FROM dataset_versions
WHERE id = ? AND dataset_id = ? AND status = 'ready'`, source.VersionID, source.DatasetID).Scan(&tableName); err != nil {
			return SafeGroupQueryResult{}, fmt.Errorf("load group query source: %w", err)
		}
		if !internalTableName.MatchString(tableName) {
			return SafeGroupQueryResult{}, errors.New("stored group table name failed validation")
		}
		profiles, physicalNames, err := service.loadColumns(ctx, source.VersionID)
		if err != nil {
			return SafeGroupQueryResult{}, err
		}
		columns := make(map[string]queryColumn, len(profiles))
		for columnIndex, profile := range profiles {
			columns[profile.Name] = queryColumn{profile: profile, physical: physicalNames[columnIndex]}
		}
		runtimeSources[index] = groupQueryRuntimeSource{reference: source, tableName: tableName, rowCount: member.RowCount, columns: columns}
	}
	compiled, err := compileSafeGroupQuery(plan, runtimeSources)
	if err != nil {
		return SafeGroupQueryResult{}, err
	}
	rows, truncated, err := service.runCompiledQuery(ctx, compiled, plan.Limit)
	if err != nil {
		return SafeGroupQueryResult{}, err
	}
	return SafeGroupQueryResult{
		GroupID: plan.GroupID, SourceVersions: plan.Sources,
		Columns: compiled.columns, Rows: rows, Truncated: truncated,
	}, nil
}

func validateGroupQueryPlanShape(plan SafeGroupQueryPlan) error {
	if plan.SchemaVersion != 1 || !objectID.MatchString(plan.GroupID) {
		return errors.New("group query identity or version is invalid")
	}
	if strings.TrimSpace(plan.Purpose) == "" || len(plan.Purpose) > 500 {
		return errors.New("group query purpose is invalid")
	}
	if plan.Sources == nil || plan.Joins == nil || plan.Dimensions == nil || plan.Measures == nil || plan.Filters == nil || plan.Sort == nil {
		return errors.New("group query arrays must be explicit")
	}
	if len(plan.Sources) < 2 || len(plan.Sources) > 8 || len(plan.Joins) != len(plan.Sources)-1 {
		return errors.New("group query must contain a connected bounded source tree")
	}
	if len(plan.Dimensions)+len(plan.Measures) == 0 || len(plan.Dimensions) > 8 || len(plan.Measures) > 8 || len(plan.Filters) > 20 || len(plan.Sort) > 3 || plan.Limit < 1 || plan.Limit > 200 {
		return errors.New("group query exceeds execution limits")
	}
	seen := make(map[string]bool, len(plan.Sources))
	for _, source := range plan.Sources {
		if !objectID.MatchString(source.DatasetID) || !objectID.MatchString(source.VersionID) || seen[source.DatasetID] {
			return errors.New("group query sources are invalid or duplicated")
		}
		seen[source.DatasetID] = true
	}
	for index, join := range plan.Joins {
		if join.RightSourceIndex != index+1 || join.LeftSourceIndex < 0 || join.LeftSourceIndex > index || (join.Type != "inner" && join.Type != "left") {
			return errors.New("group joins must add one source to the connected tree")
		}
	}
	for _, sort := range plan.Sort {
		if sort.OutputIndex < 0 || sort.OutputIndex >= len(plan.Dimensions)+len(plan.Measures) || (sort.Direction != "ascending" && sort.Direction != "descending") {
			return errors.New("group query sort is invalid")
		}
	}
	return nil
}

func compileSafeGroupQuery(
	plan SafeGroupQueryPlan,
	sources []groupQueryRuntimeSource,
) (compiledQuery, error) {
	from := sources[0].tableName + " t0"
	for _, join := range plan.Joins {
		left, err := resolveGroupColumn(sources, join.LeftSourceIndex, join.LeftColumn)
		if err != nil {
			return compiledQuery{}, err
		}
		right, err := resolveGroupColumn(sources, join.RightSourceIndex, join.RightColumn)
		if err != nil {
			return compiledQuery{}, err
		}
		rightColumn := sources[join.RightSourceIndex].columns[join.RightColumn]
		if rightColumn.profile.NullCount != 0 || rightColumn.profile.DistinctCount != sources[join.RightSourceIndex].rowCount {
			return compiledQuery{}, fmt.Errorf("right join column %q in source %d must be non-null and unique", join.RightColumn, join.RightSourceIndex+1)
		}
		keyword := "JOIN"
		if join.Type == "left" {
			keyword = "LEFT JOIN"
		}
		from += fmt.Sprintf(" %s %s t%d ON %s = %s", keyword, sources[join.RightSourceIndex].tableName, join.RightSourceIndex, left, right)
	}
	selects := make([]string, 0, len(plan.Dimensions)+len(plan.Measures))
	groups := make([]string, 0, len(plan.Dimensions))
	resultColumns := make([]QueryResultColumn, 0, cap(selects))
	for _, dimension := range plan.Dimensions {
		expression, column, err := groupColumnExpression(sources, dimension.SourceIndex, dimension.Column)
		if err != nil {
			return compiledQuery{}, err
		}
		selects = append(selects, expression)
		groups = append(groups, expression)
		resultColumns = append(resultColumns, QueryResultColumn{Label: groupColumnLabel(dimension.SourceIndex, dimension.Column), Type: column.profile.InferredType})
	}
	for _, measure := range plan.Measures {
		expression, resultColumn, err := compileGroupMeasure(measure, sources)
		if err != nil {
			return compiledQuery{}, err
		}
		selects = append(selects, expression)
		resultColumns = append(resultColumns, resultColumn)
	}
	where, args, err := compileGroupFilters(plan.Filters, sources)
	if err != nil {
		return compiledQuery{}, err
	}
	parts := []string{"SELECT " + strings.Join(selects, ", "), "FROM " + from}
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
		parts = append(parts, "ORDER BY t0.__row_number")
	}
	parts = append(parts, "LIMIT ?")
	args = append(args, plan.Limit+1)
	return compiledQuery{sql: strings.Join(parts, " "), args: args, columns: resultColumns}, nil
}

func resolveGroupColumn(sources []groupQueryRuntimeSource, sourceIndex int, name string) (string, error) {
	expression, _, err := groupColumnExpression(sources, sourceIndex, name)
	return expression, err
}

func groupColumnExpression(sources []groupQueryRuntimeSource, sourceIndex int, name string) (string, queryColumn, error) {
	if sourceIndex < 0 || sourceIndex >= len(sources) {
		return "", queryColumn{}, errors.New("group column source is invalid")
	}
	column, ok := sources[sourceIndex].columns[name]
	if !ok {
		return "", queryColumn{}, fmt.Errorf("unknown group query column %q in source %d", name, sourceIndex+1)
	}
	return fmt.Sprintf("t%d.%s", sourceIndex, column.physical), column, nil
}

func groupColumnLabel(sourceIndex int, name string) string {
	return fmt.Sprintf("Source %d · %s", sourceIndex+1, name)
}

func compileGroupMeasure(measure GroupQueryMeasure, sources []groupQueryRuntimeSource) (string, QueryResultColumn, error) {
	if measure.Operation == "count" && measure.Column == nil {
		return "COUNT(*)", QueryResultColumn{Label: "Count", Type: ColumnTypeInteger}, nil
	}
	if measure.Column == nil {
		return "", QueryResultColumn{}, errors.New("group measure column is required")
	}
	expression, column, err := groupColumnExpression(sources, measure.SourceIndex, *measure.Column)
	if err != nil {
		return "", QueryResultColumn{}, err
	}
	labelPrefix := map[string]string{"count": "Count of ", "sum": "Sum of ", "average": "Average of ", "minimum": "Minimum of ", "maximum": "Maximum of "}
	label, ok := labelPrefix[measure.Operation]
	if !ok {
		return "", QueryResultColumn{}, errors.New("unsupported group measure")
	}
	if measure.Operation == "count" {
		return "COUNT(" + expression + ")", QueryResultColumn{Label: label + groupColumnLabel(measure.SourceIndex, *measure.Column), Type: ColumnTypeInteger}, nil
	}
	if (measure.Operation == "sum" || measure.Operation == "average") && column.profile.InferredType != ColumnTypeInteger && column.profile.InferredType != ColumnTypeReal {
		return "", QueryResultColumn{}, fmt.Errorf("%s requires a numeric group column", measure.Operation)
	}
	function := map[string]string{"sum": "SUM", "average": "AVG", "minimum": "MIN", "maximum": "MAX"}[measure.Operation]
	resultType := column.profile.InferredType
	if column.profile.InferredType == ColumnTypeInteger || column.profile.InferredType == ColumnTypeReal {
		expression = "CAST(" + expression + " AS REAL)"
		if measure.Operation == "sum" || measure.Operation == "average" {
			resultType = ColumnTypeReal
		}
	}
	return function + "(" + expression + ")", QueryResultColumn{Label: label + groupColumnLabel(measure.SourceIndex, *measure.Column), Type: resultType}, nil
}

func compileGroupFilters(filters []GroupQueryFilter, sources []groupQueryRuntimeSource) (string, []any, error) {
	predicates := make([]string, 0, len(filters))
	args := make([]any, 0, len(filters))
	for _, filter := range filters {
		expression, column, err := groupColumnExpression(sources, filter.SourceIndex, filter.Column)
		if err != nil {
			return "", nil, err
		}
		if filter.Operator == "is-null" || filter.Operator == "is-not-null" {
			if filter.Value != nil {
				return "", nil, errors.New("group null filter cannot contain a value")
			}
			operator := "IS NULL"
			if filter.Operator == "is-not-null" {
				operator = "IS NOT NULL"
			}
			predicates = append(predicates, expression+" "+operator)
			continue
		}
		if filter.Value == nil || len(*filter.Value) > 10000 {
			return "", nil, errors.New("group filter value is invalid")
		}
		if filter.Operator == "contains" {
			predicates = append(predicates, "instr("+expression+", ?) > 0")
			args = append(args, *filter.Value)
			continue
		}
		operators := map[string]string{"equals": "=", "not-equals": "!=", "greater-than": ">", "greater-or-equal": ">=", "less-than": "<", "less-or-equal": "<="}
		operator, ok := operators[filter.Operator]
		if !ok {
			return "", nil, errors.New("unsupported group filter")
		}
		argument := any(*filter.Value)
		if column.profile.InferredType == ColumnTypeInteger || column.profile.InferredType == ColumnTypeReal {
			number, err := strconv.ParseFloat(*filter.Value, 64)
			if err != nil {
				return "", nil, fmt.Errorf("numeric group filter for %q is invalid", filter.Column)
			}
			expression = "CAST(" + expression + " AS REAL)"
			argument = number
		}
		predicates = append(predicates, expression+" "+operator+" ?")
		args = append(args, argument)
	}
	return strings.Join(predicates, " AND "), args, nil
}
