package data

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const (
	maximumWorkflowDefinitions = 500
	maximumWorkflowSteps       = 8
	maximumWorkflowAttempts    = 3
	maximumWorkflowRuns        = 10_000
	maximumWorkflowJSONBytes   = 1024 * 1024
)

var workflowStepID = regexp.MustCompile(`^[a-z][a-z0-9-]{0,63}$`)
var workflowIdempotencyKey = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func validateWorkflowDefinitionInput(input WorkflowDefinitionInput) error {
	if !objectID.MatchString(input.ThreadID) {
		return errors.New("workflow conversation thread is invalid")
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.ID != "" && !objectID.MatchString(input.ID) {
		return errors.New("workflow id is invalid")
	}
	if input.Name == "" || len(input.Name) > 100 {
		return errors.New("workflow name is invalid")
	}
	if !objectID.MatchString(input.Target.ID) || (input.Target.Kind != "dataset" && input.Target.Kind != "group") {
		return errors.New("workflow target is invalid")
	}
	switch input.Trigger.Kind {
	case "manual", "dataset-version":
		if input.Trigger.EveryMinutes != 0 {
			return errors.New("workflow trigger contains irrelevant schedule fields")
		}
	case "interval":
		if input.Trigger.EveryMinutes < 60 || input.Trigger.EveryMinutes > 7*24*60 {
			return errors.New("workflow interval is outside the bounded range")
		}
	default:
		return errors.New("workflow trigger is unsupported")
	}
	if input.TimeoutMS < 1_000 || input.TimeoutMS > 10*60_000 {
		return errors.New("workflow timeout is outside the bounded range")
	}
	if len(input.Steps) < 1 || len(input.Steps) > maximumWorkflowSteps {
		return fmt.Errorf("workflow must contain between 1 and %d steps", maximumWorkflowSteps)
	}
	seen := make(map[string]bool, len(input.Steps))
	for _, step := range input.Steps {
		if !workflowStepID.MatchString(step.ID) || seen[step.ID] {
			return errors.New("workflow step identities are invalid or duplicated")
		}
		seen[step.ID] = true
		if step.MaximumAttempts < 1 || step.MaximumAttempts > maximumWorkflowAttempts {
			return errors.New("workflow step retry budget is invalid")
		}
		if err := validateWorkflowStepTarget(input.Target, step); err != nil {
			return err
		}
	}
	return nil
}

func validateWorkflowStepTarget(target WorkflowTarget, step WorkflowStepDefinition) error {
	switch step.Kind {
	case "dataset-query":
		if step.Plan == nil || step.GroupPlan != nil || target.Kind != "dataset" || step.Plan.DatasetID != target.ID {
			return errors.New("dataset-query workflow step does not match its target")
		}
		return validateQueryPlanShape(*step.Plan)
	case "group-query":
		if step.GroupPlan == nil || step.Plan != nil || target.Kind != "group" || step.GroupPlan.GroupID != target.ID {
			return errors.New("group-query workflow step does not match its target")
		}
		return validateGroupQueryPlanShape(*step.GroupPlan)
	default:
		return errors.New("workflow step kind is unsupported")
	}
}

func decodeWorkflowSteps(raw string) ([]WorkflowStepDefinition, error) {
	if len(raw) > maximumWorkflowJSONBytes {
		return nil, errors.New("stored workflow steps exceed their budget")
	}
	var steps []WorkflowStepDefinition
	if err := decodeStrictWorkflowJSON([]byte(raw), &steps); err != nil {
		return nil, errors.New("stored workflow steps are invalid")
	}
	return steps, nil
}

func decodeWorkflowStepResult(raw string) (WorkflowStepResult, error) {
	if len(raw) > maximumWorkflowJSONBytes {
		return WorkflowStepResult{}, errors.New("stored workflow result exceeds its budget")
	}
	var envelope struct {
		Kind  string          `json:"kind"`
		Value json.RawMessage `json:"value"`
	}
	if err := decodeStrictWorkflowJSON([]byte(raw), &envelope); err != nil || len(envelope.Value) == 0 {
		return WorkflowStepResult{}, errors.New("stored workflow result envelope is invalid")
	}
	switch envelope.Kind {
	case "dataset-query":
		var result SafeQueryResult
		if err := decodeStrictWorkflowJSON(envelope.Value, &result); err != nil || validateWorkflowQueryResult(result.Columns, result.Rows) != nil || !objectID.MatchString(result.DatasetID) || !objectID.MatchString(result.VersionID) {
			return WorkflowStepResult{}, errors.New("stored dataset workflow result is invalid")
		}
		return WorkflowStepResult{Kind: envelope.Kind, Value: result}, nil
	case "group-query":
		var result SafeGroupQueryResult
		if err := decodeStrictWorkflowJSON(envelope.Value, &result); err != nil || validateWorkflowQueryResult(result.Columns, result.Rows) != nil || !objectID.MatchString(result.GroupID) || len(result.SourceVersions) < 2 || len(result.SourceVersions) > 8 {
			return WorkflowStepResult{}, errors.New("stored group workflow result is invalid")
		}
		for _, source := range result.SourceVersions {
			if !objectID.MatchString(source.DatasetID) || !objectID.MatchString(source.VersionID) {
				return WorkflowStepResult{}, errors.New("stored group workflow source is invalid")
			}
		}
		return WorkflowStepResult{Kind: envelope.Kind, Value: result}, nil
	default:
		return WorkflowStepResult{}, errors.New("stored workflow result kind is invalid")
	}
}

func validateWorkflowResolvedInput(kind string, raw string) error {
	if len(raw) > maximumWorkflowJSONBytes {
		return errors.New("stored workflow input exceeds its budget")
	}
	switch kind {
	case "dataset-query":
		var plan SafeQueryPlan
		if err := decodeStrictWorkflowJSON([]byte(raw), &plan); err != nil || validateQueryPlanShape(plan) != nil {
			return errors.New("stored dataset workflow input is invalid")
		}
	case "group-query":
		var plan SafeGroupQueryPlan
		if err := decodeStrictWorkflowJSON([]byte(raw), &plan); err != nil || validateGroupQueryPlanShape(plan) != nil {
			return errors.New("stored group workflow input is invalid")
		}
	default:
		return errors.New("stored workflow input kind is invalid")
	}
	return nil
}

func validateWorkflowQueryResult(columns []QueryResultColumn, rows [][]any) error {
	if len(columns) < 1 || len(columns) > 16 || len(rows) > 200 {
		return errors.New("workflow query result shape is invalid")
	}
	for _, column := range columns {
		if strings.TrimSpace(column.Label) == "" || len(column.Label) > 500 || !validColumnType(column.Type) {
			return errors.New("workflow query result column is invalid")
		}
	}
	for _, row := range rows {
		if len(row) != len(columns) {
			return errors.New("workflow query result row width is invalid")
		}
		for _, cell := range row {
			switch value := cell.(type) {
			case nil, bool, float64:
			case string:
				if len(value) > maximumQueryCellBytes {
					return errors.New("workflow query result cell is too large")
				}
			default:
				return errors.New("workflow query result cell type is invalid")
			}
		}
	}
	return nil
}

func validColumnType(value ColumnType) bool {
	switch value {
	case ColumnTypeNull, ColumnTypeBoolean, ColumnTypeInteger, ColumnTypeReal, ColumnTypeDateTime, ColumnTypeText:
		return true
	default:
		return false
	}
}

func decodeStrictWorkflowJSON(raw []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("workflow JSON contains trailing data")
	}
	return nil
}
