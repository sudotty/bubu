package data

import (
	"context"
	"testing"
)

func approvalWorkflowInput(t *testing.T, service *Service, dataset DatasetSummary) WorkflowDefinitionInput {
	input := datasetWorkflowInput(t, service, dataset, 1)
	input.Name = "Reviewed regional totals"
	input.Steps = append(input.Steps,
		WorkflowStepDefinition{ID: "human-check", Kind: "human-approval", MaximumAttempts: 1, Title: "确认结果", Action: "继续交付当前结果", Risk: "medium", ExpiresAfterMinutes: 60},
		WorkflowStepDefinition{ID: "confirmed-totals", Kind: "dataset-query", MaximumAttempts: 1, Plan: input.Steps[0].Plan},
	)
	return input
}

func TestWorkflowApprovalPausesSurvivesRecoveryAndResumesTheSameRun(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), approvalWorkflowInput(t, service, dataset))
	if err != nil {
		t.Fatal(err)
	}
	run, err := service.RunWorkflow(context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174010")
	if err != nil || run.Status != "awaiting-approval" || len(run.Steps) != 2 || run.Steps[1].Status != "awaiting-approval" {
		t.Fatalf("workflow did not pause at its human checkpoint: %#v, %v", run, err)
	}
	if err := recoverInterruptedWorkflowRuns(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	approvals, err := service.ListWorkflowApprovals(context.Background())
	if err != nil || len(approvals) != 1 || approvals[0].RunID != run.ID || approvals[0].DefinitionVersion != definition.Version || approvals[0].Target != definition.Target {
		t.Fatalf("pending workflow approval lost its exact binding: %#v, %v", approvals, err)
	}
	resumed, err := service.DecideWorkflowApproval(context.Background(), WorkflowApprovalDecisionInput{ApprovalID: approvals[0].ID, Decision: "approved"})
	if err != nil || resumed.ID != run.ID || resumed.Status != "succeeded" || len(resumed.Steps) != 3 || resumed.Steps[1].Result == nil {
		t.Fatalf("approved workflow did not resume its same durable run: %#v, %v", resumed, err)
	}
	if _, err := service.DecideWorkflowApproval(context.Background(), WorkflowApprovalDecisionInput{ApprovalID: approvals[0].ID, Decision: "approved"}); err == nil {
		t.Fatal("one workflow approval authorized a second resume")
	}
}

func TestWorkflowApprovalRejectsDefinitionDriftAndExpiresClosed(t *testing.T) {
	service, dataset := importQueryFixture(t)
	input := approvalWorkflowInput(t, service, dataset)
	definition, err := service.SaveWorkflow(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	run, err := service.RunWorkflow(context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174011")
	if err != nil {
		t.Fatal(err)
	}
	approvals, _ := service.ListWorkflowApprovals(context.Background())
	input.ID = definition.ID
	input.Name = "Changed reviewed totals"
	if _, err := service.SaveWorkflow(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if _, err := service.DecideWorkflowApproval(context.Background(), WorkflowApprovalDecisionInput{ApprovalID: approvals[0].ID, Decision: "approved"}); err == nil {
		t.Fatal("an approval survived definition drift")
	}
	closed, err := service.getWorkflowRunByID(context.Background(), run.ID)
	if err != nil || closed.Status != "failed" {
		t.Fatalf("definition drift did not close the old run: %#v, %v", closed, err)
	}

	definition, err = service.SaveWorkflow(context.Background(), approvalWorkflowInput(t, service, dataset))
	if err != nil {
		t.Fatal(err)
	}
	run, err = service.RunWorkflow(context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174012")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.database.Exec("UPDATE workflow_approval_requests SET expires_at = '2020-01-01T00:00:00Z' WHERE run_id = ?", run.ID); err != nil {
		t.Fatal(err)
	}
	if pending, err := service.ListWorkflowApprovals(context.Background()); err != nil || len(pending) != 0 {
		t.Fatalf("expired workflow approval remained actionable: %#v, %v", pending, err)
	}
	closed, _ = service.getWorkflowRunByID(context.Background(), run.ID)
	if closed.Status != "failed" {
		t.Fatalf("expired workflow approval did not close its run: %#v", closed)
	}
}
