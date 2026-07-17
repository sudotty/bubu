package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	if thread.Title != "按区域统计金额" || len(thread.Entries) != 2 || thread.Entries[0].Ordinal != 1 || thread.Entries[1].Ordinal != 2 {
		t.Fatalf("unexpected persisted timeline: %#v", thread)
	}
	reloaded, err := service.GetConversation(context.Background(), target)
	if err != nil || reloaded == nil || string(reloaded.Entries[1].Payload) != `{"proposal":{"bounded":true}}` {
		t.Fatalf("conversation did not reload: %#v, %v", reloaded, err)
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
