package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (service *Service) pauseWorkflowForApproval(ctx context.Context, run WorkflowRun, definition WorkflowDefinition, ordinal int, step WorkflowStepDefinition) (WorkflowRun, error) {
	approvalID, err := newID()
	if err != nil {
		return WorkflowRun{}, err
	}
	stepRunID, err := newID()
	if err != nil {
		return WorkflowRun{}, err
	}
	requestedAt := time.Now().UTC()
	expiresAt := requestedAt.Add(time.Duration(step.ExpiresAfterMinutes) * time.Minute)
	inputJSON, _ := json.Marshal(workflowStepInput(step))
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return WorkflowRun{}, fmt.Errorf("begin workflow approval: %w", err)
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO workflow_step_runs(id, run_id, step_id, ordinal, kind, status, attempt, resolved_input_json, started_at)
VALUES (?, ?, ?, ?, 'human-approval', 'running', 1, ?, ?)`, stepRunID, run.ID, step.ID, ordinal, string(inputJSON), requestedAt.Format(time.RFC3339Nano)); err != nil {
		return WorkflowRun{}, fmt.Errorf("start workflow approval step: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
INSERT INTO workflow_approval_requests(
 id, workflow_id, definition_version, run_id, step_id, ordinal, target_kind, target_id,
 title, action, risk, status, requested_at, expires_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
		approvalID, definition.ID, definition.Version, run.ID, step.ID, ordinal,
		definition.Target.Kind, definition.Target.ID, step.Title, step.Action, step.Risk,
		requestedAt.Format(time.RFC3339Nano), expiresAt.Format(time.RFC3339Nano)); err != nil {
		return WorkflowRun{}, fmt.Errorf("persist workflow approval: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return WorkflowRun{}, fmt.Errorf("commit workflow approval: %w", err)
	}
	loaded, err := service.getWorkflowRunByID(ctx, run.ID)
	if err != nil {
		return WorkflowRun{}, err
	}
	markRunAwaitingApproval(&loaded, ordinal)
	return loaded, nil
}

func (service *Service) ListWorkflowApprovals(ctx context.Context) ([]WorkflowApprovalRequest, error) {
	if err := service.expireWorkflowApprovals(ctx, time.Now().UTC()); err != nil {
		return nil, err
	}
	rows, err := service.database.QueryContext(ctx, workflowApprovalSelect+" WHERE approvals.status = 'pending' ORDER BY approvals.requested_at, approvals.id LIMIT 100")
	if err != nil {
		return nil, fmt.Errorf("list workflow approvals: %w", err)
	}
	defer rows.Close()
	result := make([]WorkflowApprovalRequest, 0)
	for rows.Next() {
		approval, err := scanWorkflowApproval(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, approval)
	}
	return result, rows.Err()
}

func (service *Service) DecideWorkflowApproval(ctx context.Context, input WorkflowApprovalDecisionInput) (WorkflowRun, error) {
	if !objectID.MatchString(input.ApprovalID) || (input.Decision != "approved" && input.Decision != "rejected") || (input.Note != nil && (strings.TrimSpace(*input.Note) == "" || len(*input.Note) > 500)) {
		return WorkflowRun{}, errors.New("workflow approval decision is invalid")
	}
	now := time.Now().UTC()
	if err := service.expireWorkflowApprovals(ctx, now); err != nil {
		return WorkflowRun{}, err
	}
	approval, err := service.getPendingWorkflowApproval(ctx, input.ApprovalID)
	if err != nil {
		return WorkflowRun{}, err
	}
	definition, err := service.GetWorkflow(ctx, approval.WorkflowID)
	if err != nil {
		return WorkflowRun{}, err
	}
	if definition.Version != approval.DefinitionVersion || definition.Target != approval.Target {
		if err := service.terminalWorkflowApproval(ctx, approval, "cancelled", "Workflow definition or target changed", now); err != nil {
			return WorkflowRun{}, err
		}
		return WorkflowRun{}, errors.New("workflow definition changed after approval was requested")
	}
	if input.Decision == "rejected" {
		if err := service.terminalWorkflowApproval(ctx, approval, "rejected", noteOrDefault(input.Note, "Workflow approval was rejected"), now); err != nil {
			return WorkflowRun{}, err
		}
		return service.getWorkflowRunByID(ctx, approval.RunID)
	}
	if err := service.approveWorkflowApproval(ctx, approval, input.Note, now); err != nil {
		return WorkflowRun{}, err
	}
	run, err := service.getWorkflowRunByID(ctx, approval.RunID)
	if err != nil {
		return WorkflowRun{}, err
	}
	runContext, cancel := context.WithTimeout(ctx, time.Duration(definition.TimeoutMS)*time.Millisecond)
	defer cancel()
	return service.executeWorkflowRun(runContext, context.WithoutCancel(ctx), run, definition)
}

func (service *Service) approveWorkflowApproval(ctx context.Context, approval WorkflowApprovalRequest, note *string, now time.Time) error {
	decidedAt := now.Format(time.RFC3339Nano)
	resultJSON, _ := json.Marshal(WorkflowStepResult{Kind: "human-approval", Value: map[string]any{"approvalId": approval.ID, "decision": "approved", "decidedAt": decidedAt}})
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	result, err := transaction.ExecContext(ctx, `UPDATE workflow_approval_requests SET status = 'approved', decided_at = ?, decision_note = ? WHERE id = ? AND status = 'pending'`, decidedAt, nullableTrimmed(note), approval.ID)
	if err != nil || exactlyOne(result) != nil {
		return errors.New("workflow approval was not pending")
	}
	if _, err := transaction.ExecContext(ctx, `UPDATE workflow_step_runs SET status = 'succeeded', result_json = ?, finished_at = ? WHERE run_id = ? AND ordinal = ? AND status = 'running'`, string(resultJSON), decidedAt, approval.RunID, approval.Ordinal); err != nil {
		return fmt.Errorf("finish workflow approval step: %w", err)
	}
	return transaction.Commit()
}

func (service *Service) terminalWorkflowApproval(ctx context.Context, approval WorkflowApprovalRequest, status, message string, now time.Time) error {
	finishedAt := now.Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `UPDATE workflow_approval_requests SET status = ?, decided_at = ?, decision_note = ? WHERE id = ? AND status = 'pending'`, status, finishedAt, message, approval.ID); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(ctx, `UPDATE workflow_step_runs SET status = 'failed', error = ?, finished_at = ? WHERE run_id = ? AND ordinal = ? AND status = 'running'`, message, finishedAt, approval.RunID, approval.Ordinal); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(ctx, `UPDATE workflow_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ? AND status = 'running'`, message, finishedAt, approval.RunID); err != nil {
		return err
	}
	return transaction.Commit()
}

func (service *Service) expireWorkflowApprovals(ctx context.Context, now time.Time) error {
	rows, err := service.database.QueryContext(ctx, workflowApprovalSelect+" WHERE approvals.status = 'pending' AND approvals.expires_at <= ?", now.Format(time.RFC3339Nano))
	if err != nil {
		return err
	}
	defer rows.Close()
	var expired []WorkflowApprovalRequest
	for rows.Next() {
		approval, scanErr := scanWorkflowApproval(rows)
		if scanErr != nil {
			return scanErr
		}
		expired = append(expired, approval)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, approval := range expired {
		if err := service.terminalWorkflowApproval(ctx, approval, "expired", "Workflow approval expired", now); err != nil {
			return err
		}
	}
	return nil
}

const workflowApprovalSelect = `SELECT approvals.id, approvals.workflow_id, approvals.definition_version,
 approvals.run_id, approvals.step_id, approvals.ordinal, approvals.target_kind, approvals.target_id,
 approvals.title, approvals.action, approvals.risk, approvals.status, approvals.requested_at,
 approvals.expires_at, approvals.decided_at, approvals.decision_note FROM workflow_approval_requests approvals`

func (service *Service) getPendingWorkflowApproval(ctx context.Context, id string) (WorkflowApprovalRequest, error) {
	approval, err := scanWorkflowApproval(service.database.QueryRowContext(ctx, workflowApprovalSelect+" WHERE approvals.id = ? AND approvals.status = 'pending'", id))
	if errors.Is(err, sql.ErrNoRows) {
		return WorkflowApprovalRequest{}, errors.New("workflow approval was not pending")
	}
	return approval, err
}

func scanWorkflowApproval(scanner workflowScanner) (WorkflowApprovalRequest, error) {
	var approval WorkflowApprovalRequest
	var decidedAt, note sql.NullString
	approval.SchemaVersion = 1
	if err := scanner.Scan(&approval.ID, &approval.WorkflowID, &approval.DefinitionVersion, &approval.RunID,
		&approval.StepID, &approval.Ordinal, &approval.Target.Kind, &approval.Target.ID, &approval.Title,
		&approval.Action, &approval.Risk, &approval.Status, &approval.RequestedAt, &approval.ExpiresAt, &decidedAt, &note); err != nil {
		return WorkflowApprovalRequest{}, err
	}
	approval.DecidedAt = nullableString(decidedAt)
	approval.DecisionNote = nullableString(note)
	return approval, nil
}

func noteOrDefault(note *string, fallback string) string {
	if note != nil && strings.TrimSpace(*note) != "" {
		return strings.TrimSpace(*note)
	}
	return fallback
}

func nullableTrimmed(value *string) any {
	if value == nil {
		return nil
	}
	return strings.TrimSpace(*value)
}

func exactlyOne(result sql.Result) error {
	if result == nil {
		return errors.New("no result")
	}
	count, err := result.RowsAffected()
	if err != nil || count != 1 {
		return errors.New("expected one row")
	}
	return nil
}
