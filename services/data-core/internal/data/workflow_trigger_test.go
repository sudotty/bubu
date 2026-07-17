package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestIntervalWorkflowTriggerPersistsAndRunsIdempotently(t *testing.T) {
	service, dataset := importQueryFixture(t)
	if _, err := service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: ConversationTarget{Kind: "dataset", ID: dataset.ID},
		Entry: ConversationEntryInput{
			Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"Daily regional totals"}`),
		},
	}); err != nil {
		t.Fatal(err)
	}
	input := datasetWorkflowInput(dataset, 1)
	input.Trigger = WorkflowTrigger{Kind: "interval", EveryMinutes: 24 * 60}
	definition, err := service.SaveWorkflow(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if definition.NextDueAt == nil {
		t.Fatal("interval workflow did not persist its next due time")
	}
	dueAt := time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano)
	if _, err := service.database.Exec("UPDATE workflow_definitions SET next_due_at = ? WHERE id = ?", dueAt, definition.ID); err != nil {
		t.Fatal(err)
	}
	events, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(events) != 1 || events[0].Status != "pending" || !workflowIdempotencyKey.MatchString(events[0].OperationID) {
		t.Fatalf("interval trigger was not claimed: %#v, %v", events, err)
	}
	repeated, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(repeated) != 1 || repeated[0].ID != events[0].ID {
		t.Fatalf("pending trigger was duplicated: %#v, %v", repeated, err)
	}
	run, err := service.RunWorkflow(context.Background(), definition.ID, events[0].OperationID)
	if err != nil || run.Status != "succeeded" {
		t.Fatalf("triggered workflow did not run: %#v, %v", run, err)
	}
	finished, err := service.FinishWorkflowTrigger(context.Background(), WorkflowTriggerFinishInput{
		ID: events[0].ID, Status: "succeeded", RunID: &run.ID,
	})
	if err != nil || finished.Status != "succeeded" {
		t.Fatalf("trigger event did not finish: %#v, %v", finished, err)
	}
	thread, err := service.GetConversation(context.Background(), ConversationTarget{Kind: "dataset", ID: dataset.ID})
	if err != nil || thread == nil || len(thread.Entries) != 2 || thread.Entries[1].Kind != "result" {
		t.Fatalf("triggered result was not delivered atomically to the conversation: %#v, %v", thread, err)
	}
	var delivered struct {
		SourcePlan *SafeQueryPlan `json:"sourcePlan"`
	}
	if err := json.Unmarshal(thread.Entries[1].Payload, &delivered); err != nil || delivered.SourcePlan == nil ||
		delivered.SourcePlan.DatasetID != dataset.ID || delivered.SourcePlan.VersionID != dataset.VersionID {
		t.Fatalf("triggered result did not retain its immutable source plan: %#v, %v", delivered, err)
	}
}

func TestDatasetVersionTriggerFiresOnlyAfterReplacement(t *testing.T) {
	service, dataset := importQueryFixture(t)
	input := datasetWorkflowInput(dataset, 1)
	input.Trigger = WorkflowTrigger{Kind: "dataset-version"}
	definition, err := service.SaveWorkflow(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	before, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(before) != 0 {
		t.Fatalf("version trigger fired before replacement: %#v, %v", before, err)
	}
	replacement := filepath.Join(t.TempDir(), "replacement.csv")
	if err := os.WriteFile(replacement, []byte("Region,Amount,Status\nNorth,90,paid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if result, err := service.ReplaceFile(context.Background(), dataset.ID, replacement); err != nil || result.Dataset == nil {
		t.Fatalf("replace trigger dataset: %#v, %v", result, err)
	}
	after, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(after) != 1 || after[0].WorkflowID != definition.ID || after[0].TriggerKind != "dataset-version" {
		t.Fatalf("version trigger did not fire after replacement: %#v, %v", after, err)
	}
}

func TestInterruptedTriggeredRunBecomesDeliverableFailure(t *testing.T) {
	service, dataset := importQueryFixture(t)
	if _, err := service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: ConversationTarget{Kind: "dataset", ID: dataset.ID},
		Entry: ConversationEntryInput{
			Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"Recover automation"}`),
		},
	}); err != nil {
		t.Fatal(err)
	}
	input := datasetWorkflowInput(dataset, 1)
	input.Trigger = WorkflowTrigger{Kind: "interval", EveryMinutes: 60}
	definition, err := service.SaveWorkflow(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	dueAt := time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano)
	if _, err := service.database.Exec("UPDATE workflow_definitions SET next_due_at = ? WHERE id = ?", dueAt, definition.ID); err != nil {
		t.Fatal(err)
	}
	events, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(events) != 1 {
		t.Fatalf("claim recovery trigger: %#v, %v", events, err)
	}
	run, err := service.startWorkflowRun(context.Background(), definition, events[0].OperationID)
	if err != nil {
		t.Fatal(err)
	}
	if err := recoverInterruptedWorkflowRuns(context.Background(), service.database); err != nil {
		t.Fatal(err)
	}
	recovered, err := service.RunWorkflow(context.Background(), definition.ID, events[0].OperationID)
	if err != nil || recovered.ID != run.ID || recovered.Status != "failed" || recovered.Error == nil {
		t.Fatalf("interrupted run was not recovered idempotently: %#v, %v", recovered, err)
	}
	finished, err := service.FinishWorkflowTrigger(context.Background(), WorkflowTriggerFinishInput{
		ID: events[0].ID, Status: "failed", RunID: &recovered.ID, Error: recovered.Error,
	})
	if err != nil || finished.Status != "failed" {
		t.Fatalf("recovered trigger failure was not delivered: %#v, %v", finished, err)
	}
}

func TestGroupVersionTriggerTracksOrderedMemberVersions(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), WorkflowDefinitionInput{
		Name: "Group lookup", Target: WorkflowTarget{Kind: "group", ID: group.ID},
		Trigger: WorkflowTrigger{Kind: "dataset-version"}, TimeoutMS: 60_000,
		Steps: []WorkflowStepDefinition{{
			ID: "group-lookup", Kind: "group-query", MaximumAttempts: 1,
			GroupPlan: groupPlanPointer(baseGroupQueryPlan(group)),
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if events, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano)); err != nil || len(events) != 0 {
		t.Fatalf("group trigger fired before member replacement: %#v, %v", events, err)
	}
	replacement := filepath.Join(t.TempDir(), "orders-next.csv")
	if err := os.WriteFile(replacement, []byte("Order ID,Product ID,Quantity\nO-5,P-1,4\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if result, err := service.ReplaceFile(context.Background(), group.Members[0].ID, replacement); err != nil || result.Dataset == nil {
		t.Fatalf("replace group member: %#v, %v", result, err)
	}
	events, err := service.ClaimDueWorkflowTriggers(context.Background(), time.Now().UTC().Format(time.RFC3339Nano))
	if err != nil || len(events) != 1 || events[0].WorkflowID != definition.ID || events[0].Target.ID != group.ID {
		t.Fatalf("group member version trigger did not fire: %#v, %v", events, err)
	}
}

func groupPlanPointer(plan SafeGroupQueryPlan) *SafeGroupQueryPlan { return &plan }
