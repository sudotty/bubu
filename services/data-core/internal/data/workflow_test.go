package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func workflowThreadID(t *testing.T, service *Service, target ConversationTarget) string {
	t.Helper()
	created, err := service.CreateConversation(context.Background(), ConversationCreateInput{Target: target, Title: "Reviewed workflow plan"})
	if err != nil || created == nil {
		t.Fatalf("create workflow conversation: %#v, %v", created, err)
	}
	thread, err := service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target:   target,
		ThreadID: created.ID,
		Entry:    ConversationEntryInput{Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"Reviewed workflow plan"}`)},
	})
	if err != nil || thread == nil {
		t.Fatalf("create workflow conversation: %#v, %v", thread, err)
	}
	return thread.ID
}

func datasetWorkflowInput(t *testing.T, service *Service, dataset DatasetSummary, maximumAttempts int) WorkflowDefinitionInput {
	return WorkflowDefinitionInput{
		Name:      "Regional totals",
		Target:    WorkflowTarget{Kind: "dataset", ID: dataset.ID},
		ThreadID:  workflowThreadID(t, service, ConversationTarget{Kind: "dataset", ID: dataset.ID}),
		Trigger:   WorkflowTrigger{Kind: "manual"},
		TimeoutMS: 60_000,
		Steps: []WorkflowStepDefinition{{
			ID: "regional-totals", Kind: "dataset-query", MaximumAttempts: maximumAttempts,
			Plan: &SafeQueryPlan{
				SchemaVersion: 1, DatasetID: dataset.ID, VersionID: dataset.VersionID,
				Purpose: "Paid totals", Dimensions: []string{"Region"},
				Measures: []QueryMeasure{{Operation: "sum", Column: text("Amount")}},
				Filters:  []QueryFilter{}, Sort: []QuerySort{}, Limit: 20,
			},
		}},
	}
}

func TestWorkflowPersistsVersionedDefinitionsAndIdempotentCheckpoints(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), datasetWorkflowInput(t, service, dataset, 2))
	if err != nil {
		t.Fatal(err)
	}
	if definition.Version != 1 || definition.Target.ID != dataset.ID {
		t.Fatalf("unexpected workflow definition: %#v", definition)
	}
	listed, err := service.ListWorkflows(context.Background(), &definition.Target)
	if err != nil || len(listed) != 1 || listed[0].ID != definition.ID {
		t.Fatalf("workflow was not listed: %#v, %v", listed, err)
	}

	key := "123e4567-e89b-42d3-a456-426614174000"
	run, err := service.RunWorkflow(context.Background(), definition.ID, key)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != "succeeded" || len(run.Steps) != 1 || run.Steps[0].Result == nil {
		t.Fatalf("workflow did not checkpoint a successful result: %#v", run)
	}
	duplicate, err := service.RunWorkflow(context.Background(), definition.ID, key)
	if err != nil || duplicate.ID != run.ID {
		t.Fatalf("idempotent replay created another run: %#v, %v", duplicate, err)
	}
	runs, err := service.ListWorkflowRuns(context.Background(), definition.ID)
	if err != nil || len(runs) != 1 {
		t.Fatalf("unexpected workflow history: %#v, %v", runs, err)
	}
}

func TestWorkflowRebindsACompatibleCurrentDatasetVersion(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), datasetWorkflowInput(t, service, dataset, 1))
	if err != nil {
		t.Fatal(err)
	}
	replacement := filepath.Join(t.TempDir(), "replacement.csv")
	if err := os.WriteFile(replacement, []byte("Region,Amount,Status\nWest,99,paid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	replaced, err := service.ReplaceFile(context.Background(), dataset.ID, replacement)
	if err != nil || replaced.Dataset == nil {
		t.Fatalf("replace fixture: %#v, %v", replaced, err)
	}
	run, err := service.RunWorkflow(
		context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174001",
	)
	if err != nil || run.Status != "succeeded" {
		t.Fatalf("workflow did not run on the replacement: %#v, %v", run, err)
	}
	encoded, err := json.Marshal(run.Steps[0].Result)
	if err != nil || !strings.Contains(string(encoded), replaced.Dataset.VersionID) || strings.Contains(string(encoded), dataset.VersionID) {
		t.Fatalf("workflow result was not rebound to the current version: %s, %v", encoded, err)
	}
}

func TestWorkflowRetriesBoundedFailuresAndRetiresWithItsTarget(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), datasetWorkflowInput(t, service, dataset, 2))
	if err != nil {
		t.Fatal(err)
	}
	corrupt := datasetWorkflowInput(t, service, dataset, 2).Steps
	corrupt[0].Plan.Dimensions = []string{"Missing"}
	raw, _ := json.Marshal(corrupt)
	if _, err := service.database.Exec("UPDATE workflow_definitions SET steps_json = ? WHERE id = ?", string(raw), definition.ID); err != nil {
		t.Fatal(err)
	}
	run, err := service.RunWorkflow(
		context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174002",
	)
	if err != nil || run.Status != "failed" || len(run.Steps) != 2 {
		t.Fatalf("workflow did not use its bounded retry budget: %#v, %v", run, err)
	}
	if _, err := service.DeleteDataset(context.Background(), dataset.ID); err != nil {
		t.Fatal(err)
	}
	if workflows, err := service.ListWorkflows(context.Background(), nil); err != nil || len(workflows) != 0 {
		t.Fatalf("deleted target left an active workflow: %#v, %v", workflows, err)
	}
}

func TestWorkflowCancellationAfterRunStartPersistsTerminalAudit(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), datasetWorkflowInput(t, service, dataset, 1))
	if err != nil {
		t.Fatal(err)
	}
	run, err := service.startWorkflowRun(
		context.Background(), definition, "123e4567-e89b-42d3-a456-426614174003",
	)
	if err != nil {
		t.Fatal(err)
	}
	runContext, cancel := context.WithCancel(context.Background())
	cancel()
	finished, err := service.executeWorkflowRun(
		runContext, context.Background(), run, definition,
	)
	if err != nil {
		t.Fatal(err)
	}
	if finished.Status != "cancelled" || finished.FinishedAt == nil || len(finished.Steps) != 1 {
		t.Fatalf("cancelled workflow did not persist terminal audit: %#v", finished)
	}
	step := finished.Steps[0]
	if step.Status != "cancelled" || step.FinishedAt == nil || step.Error == nil {
		t.Fatalf("cancelled workflow step did not persist its terminal checkpoint: %#v", step)
	}
}

func TestWorkflowResolvedInputsRejectUntypedArtifacts(t *testing.T) {
	service, dataset := importQueryFixture(t)
	plan := datasetWorkflowInput(t, service, dataset, 1).Steps[0].Plan
	raw, err := json.Marshal(plan)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateWorkflowResolvedInput("dataset-query", string(raw)); err != nil {
		t.Fatalf("valid resolved query plan was rejected: %v", err)
	}
	if err := validateWorkflowResolvedInput(
		"dataset-query", `{"schemaVersion":1,"command":"rm"}`,
	); err == nil {
		t.Fatal("untyped workflow checkpoint input was accepted")
	}
}
