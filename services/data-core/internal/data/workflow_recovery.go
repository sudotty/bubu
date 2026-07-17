package data

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

const interruptedWorkflowError = "Application stopped before the workflow run completed"

func recoverInterruptedWorkflowRuns(ctx context.Context, database *sql.DB) error {
	finishedAt := time.Now().UTC().Format(time.RFC3339Nano)
	transaction, err := database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin interrupted workflow recovery: %w", err)
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_step_runs
SET status = 'failed', error = ?, finished_at = ?
WHERE status = 'running'`, interruptedWorkflowError, finishedAt); err != nil {
		return fmt.Errorf("recover interrupted workflow steps: %w", err)
	}
	if _, err := transaction.ExecContext(ctx, `
UPDATE workflow_runs
SET status = 'failed', error = ?, finished_at = ?
WHERE status = 'running'`, interruptedWorkflowError, finishedAt); err != nil {
		return fmt.Errorf("recover interrupted workflow runs: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit interrupted workflow recovery: %w", err)
	}
	return nil
}
