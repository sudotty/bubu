package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConversationMigrationPreservesVersionTenTimeline(t *testing.T) {
	dataDirectory := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dataDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", filepath.Join(dataDirectory, "bubu.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`); err != nil {
		t.Fatal(err)
	}
	for _, migration := range migrations[:10] {
		if _, err := database.Exec(migration.sql); err != nil {
			t.Fatalf("apply setup migration %d: %v", migration.version, err)
		}
		if _, err := database.Exec("INSERT INTO schema_migrations(version) VALUES (?)", migration.version); err != nil {
			t.Fatal(err)
		}
	}
	datasetID := strings.Repeat("a", 32)
	threadID := strings.Repeat("b", 32)
	entryID := strings.Repeat("c", 32)
	if _, err := database.Exec(`INSERT INTO datasets(
id, display_name, source_kind, source_name, source_locator, created_at, updated_at
) VALUES (?, 'Sales', 'csv', 'sales.csv', '', '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z')`, datasetID); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO conversation_threads(
id, target_kind, target_id, title, created_at, updated_at
) VALUES (?, 'dataset', ?, 'Existing', '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z')`, threadID, datasetID); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO conversation_entries(
id, thread_id, ordinal, kind, role, payload_json, created_at
) VALUES (?, ?, 1, 'question', 'user', '{"question":"Existing"}', '2026-07-17T00:00:00Z')`, entryID, threadID); err != nil {
		t.Fatal(err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, dataDirectory)
	target := ConversationTarget{Kind: "dataset", ID: datasetID}
	thread, err := service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: target,
		Entry:  ConversationEntryInput{Kind: "insight", Role: "assistant", Payload: json.RawMessage(`{"explanation":{"summary":"Preserved"}}`)},
	})
	if err != nil || thread == nil || len(thread.Entries) != 2 || thread.Entries[0].Kind != "question" || thread.Entries[1].Kind != "insight" {
		t.Fatalf("version-ten conversation did not migrate without loss: %#v, %v", thread, err)
	}
}

func TestConversationPersistsAnAppendOnlyTypedTimeline(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	if err := os.WriteFile(source, []byte("Region,Amount\nNorth,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	target := ConversationTarget{Kind: "dataset", ID: imported.Datasets[0].ID}
	thread, err := service.GetConversation(context.Background(), target)
	if err != nil || thread != nil {
		t.Fatalf("new target unexpectedly has a conversation: %#v, %v", thread, err)
	}
	thread, err = service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: target,
		Entry:  ConversationEntryInput{Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"按区域统计金额"}`)},
	})
	if err != nil {
		t.Fatal(err)
	}
	thread, err = service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: target,
		Entry:  ConversationEntryInput{Kind: "plan", Role: "assistant", Payload: json.RawMessage(`{"proposal":{"bounded":true}}`)},
	})
	if err != nil {
		t.Fatal(err)
	}
	thread, err = service.AppendConversationEntry(context.Background(), ConversationAppendInput{
		Target: target,
		Entry:  ConversationEntryInput{Kind: "insight", Role: "assistant", Payload: json.RawMessage(`{"explanation":{"schemaVersion":1,"summary":"North leads"}}`)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if thread.Title != "按区域统计金额" || len(thread.Entries) != 3 || thread.Entries[0].Ordinal != 1 || thread.Entries[2].Ordinal != 3 {
		t.Fatalf("unexpected persisted timeline: %#v", thread)
	}
	reloaded, err := service.GetConversation(context.Background(), target)
	if err != nil || reloaded == nil || reloaded.Entries[2].Kind != "insight" ||
		string(reloaded.Entries[2].Payload) != `{"explanation":{"schemaVersion":1,"summary":"North leads"}}` {
		t.Fatalf("conversation did not reload: %#v, %v", reloaded, err)
	}
}

func TestConversationThreadsAreIndependentForOneDataset(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sales.csv")
	if err := os.WriteFile(source, []byte("Region,Amount\nNorth,10\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	target := ConversationTarget{Kind: "dataset", ID: imported.Datasets[0].ID}
	first, err := service.CreateConversation(context.Background(), ConversationCreateInput{Target: target, Title: "按区域统计"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.CreateConversation(context.Background(), ConversationCreateInput{Target: target, Title: "检查异常"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = service.AppendConversationEntry(context.Background(), ConversationAppendInput{Target: target, ThreadID: first.ID, Entry: ConversationEntryInput{Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"按区域统计"}`)}}); err != nil {
		t.Fatal(err)
	}
	loadedFirst, err := service.GetConversationByID(context.Background(), first.ID)
	if err != nil || loadedFirst == nil || len(loadedFirst.Entries) != 1 {
		t.Fatalf("first thread was not isolated: %#v, %v", loadedFirst, err)
	}
	loadedSecond, err := service.GetConversationByID(context.Background(), second.ID)
	if err != nil || loadedSecond == nil || len(loadedSecond.Entries) != 0 {
		t.Fatalf("second thread changed unexpectedly: %#v, %v", loadedSecond, err)
	}
	autoNamed, err := service.CreateConversation(context.Background(), ConversationCreateInput{Target: target})
	if err != nil || autoNamed == nil {
		t.Fatal(err)
	}
	autoNamed, err = service.AppendConversationEntry(context.Background(), ConversationAppendInput{Target: target, ThreadID: autoNamed.ID, Entry: ConversationEntryInput{Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"自动生成线程标题"}`)}})
	if err != nil || autoNamed == nil || autoNamed.Title != "自动生成线程标题" {
		t.Fatalf("first question did not name the thread: %#v, %v", autoNamed, err)
	}
	threads, err := service.ListConversations(context.Background(), target, false)
	if err != nil || len(threads) != 3 {
		t.Fatalf("expected three active threads, got %#v, %v", threads, err)
	}
	if err := service.ArchiveConversation(context.Background(), ConversationArchiveInput{ThreadID: second.ID, Archived: true}); err != nil {
		t.Fatal(err)
	}
	threads, err = service.ListConversations(context.Background(), target, false)
	if err != nil || len(threads) != 2 {
		t.Fatalf("archive did not hide one thread: %#v, %v", threads, err)
	}
	archived, err := service.ListConversations(context.Background(), target, true)
	if err != nil || len(archived) != 1 || archived[0].ID != second.ID {
		t.Fatalf("archived thread was not recoverable: %#v, %v", archived, err)
	}
}

func TestConversationRejectsInvalidTargetsRolesAndPayloads(t *testing.T) {
	service := openTestService(t, filepath.Join(t.TempDir(), "data"))
	missing := ConversationTarget{Kind: "dataset", ID: strings.Repeat("f", 32)}
	input := ConversationAppendInput{
		Target: missing,
		Entry:  ConversationEntryInput{Kind: "question", Role: "user", Payload: json.RawMessage(`{"question":"Hello"}`)},
	}
	if _, err := service.AppendConversationEntry(context.Background(), input); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected missing target rejection, got %v", err)
	}
	input.Entry.Role = "assistant"
	if _, err := service.AppendConversationEntry(context.Background(), input); err == nil || !strings.Contains(err.Error(), "kind and role") {
		t.Fatalf("expected role rejection, got %v", err)
	}
	input.Entry.Role = "user"
	input.Entry.Payload = json.RawMessage(`[]`)
	if _, err := service.AppendConversationEntry(context.Background(), input); err == nil || !strings.Contains(err.Error(), "object") {
		t.Fatalf("expected payload rejection, got %v", err)
	}
}
