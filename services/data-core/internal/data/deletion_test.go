package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDeleteDatasetRemovesPrivateStateAndRepairsAffectedGroups(t *testing.T) {
	root := t.TempDir()
	paths := []string{
		filepath.Join(root, "a.csv"),
		filepath.Join(root, "b.csv"),
		filepath.Join(root, "c.csv"),
	}
	for index, path := range paths {
		contents := "Key,Value\nK-1," + string(rune('A'+index)) + "\nK-2,X\n"
		if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFiles(context.Background(), paths)
	if err != nil {
		t.Fatal(err)
	}
	a, b, c := imported.Datasets[0], imported.Datasets[1], imported.Datasets[2]
	if _, err := service.ReplaceFile(context.Background(), a.ID, paths[0]); err != nil {
		t.Fatal(err)
	}
	groupAB, err := service.SaveGroup(context.Background(), "", "AB", "", "one-off", []string{a.ID, b.ID})
	if err != nil {
		t.Fatal(err)
	}
	groupABC, err := service.SaveGroup(context.Background(), "", "ABC", "", "one-off", []string{a.ID, b.ID, c.ID})
	if err != nil {
		t.Fatal(err)
	}
	question := json.RawMessage(`{"question":"private"}`)
	for _, target := range []ConversationTarget{{Kind: "dataset", ID: a.ID}, {Kind: "group", ID: groupAB.ID}} {
		if _, err := service.AppendConversationEntry(context.Background(), ConversationAppendInput{
			Target: target,
			Entry:  ConversationEntryInput{Kind: "question", Role: "user", Payload: question},
		}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := service.SaveValidationRules(context.Background(), a.ID, []ValidationRule{{Kind: "required", Column: "Key"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.SaveRelationship(context.Background(), DatasetRelationshipSaveInput{
		Left:  RelationshipEndpoint{DatasetID: a.ID, Column: "Key"},
		Right: RelationshipEndpoint{DatasetID: b.ID, Column: "Key"},
	}); err != nil {
		t.Fatal(err)
	}
	transaction, err := service.database.Begin()
	if err != nil {
		t.Fatal(err)
	}
	tableNames, err := datasetVersionTableNames(context.Background(), transaction, a.ID)
	if err != nil {
		transaction.Rollback()
		t.Fatal(err)
	}
	if err := transaction.Rollback(); err != nil {
		t.Fatal(err)
	}

	result, err := service.DeleteDataset(context.Background(), a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.RemovedGroupIDs) != 1 || result.RemovedGroupIDs[0] != groupAB.ID ||
		len(result.UpdatedGroupIDs) != 1 || result.UpdatedGroupIDs[0] != groupABC.ID {
		t.Fatalf("unexpected group repair result: %#v", result)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 2 {
		t.Fatalf("unexpected remaining datasets: %#v err=%v", datasets, err)
	}
	groups, err := service.ListGroups(context.Background())
	if err != nil || len(groups) != 1 || groups[0].ID != groupABC.ID || len(groups[0].Members) != 2 {
		t.Fatalf("affected groups were not repaired: %#v err=%v", groups, err)
	}
	for _, tableName := range tableNames {
		var count int
		if err := service.database.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?", tableName).Scan(&count); err != nil || count != 0 {
			t.Fatalf("physical version table survived deletion: %s count=%d err=%v", tableName, count, err)
		}
	}
	for _, assertion := range []struct {
		query string
		args  []any
	}{
		{
			query: "SELECT COUNT(*) FROM conversation_threads WHERE target_id IN (?, ?)",
			args:  []any{a.ID, groupAB.ID},
		},
		{
			query: "SELECT COUNT(*) FROM dataset_validation_rules WHERE dataset_id = ?",
			args:  []any{a.ID},
		},
		{
			query: "SELECT COUNT(*) FROM dataset_relationships WHERE left_dataset_id = ? OR right_dataset_id = ?",
			args:  []any{a.ID, a.ID},
		},
	} {
		var count int
		if err := service.database.QueryRow(assertion.query, assertion.args...).Scan(&count); err != nil || count != 0 {
			t.Fatalf("private dependent state survived deletion: count=%d err=%v", count, err)
		}
	}
}
