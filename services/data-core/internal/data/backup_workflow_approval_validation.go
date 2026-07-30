package data

import (
	"context"
	"database/sql"
	"errors"
)

func validateBackupWorkflowApprovals(ctx context.Context, database *sql.DB) error {
	var invalid int
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM workflow_approval_requests approvals
JOIN workflow_definitions definitions ON definitions.id = approvals.workflow_id
JOIN workflow_runs runs ON runs.id = approvals.run_id
JOIN workflow_step_runs steps ON steps.run_id = approvals.run_id AND steps.ordinal = approvals.ordinal
WHERE approvals.definition_version <> runs.definition_version
   OR approvals.workflow_id <> runs.workflow_id
   OR approvals.target_kind <> definitions.target_kind
   OR approvals.target_id <> definitions.target_id
   OR approvals.step_id <> steps.step_id
   OR steps.kind <> 'human-approval'
   OR approvals.expires_at <= approvals.requested_at
   OR (approvals.status = 'pending' AND (runs.status <> 'running' OR steps.status <> 'running' OR approvals.decided_at IS NOT NULL))
   OR (approvals.status = 'approved' AND (steps.status <> 'succeeded' OR steps.result_json IS NULL OR approvals.decided_at IS NULL))
   OR (approvals.status IN ('rejected', 'expired', 'cancelled') AND (runs.status <> 'failed' OR steps.status <> 'failed' OR approvals.decided_at IS NULL))`).Scan(&invalid); err != nil {
		return err
	}
	if invalid != 0 {
		return errors.New("backup contains invalid workflow approval evidence")
	}
	return nil
}
