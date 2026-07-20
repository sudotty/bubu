package data

import "encoding/json"

type ConversationTarget struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

type ConversationEntryInput struct {
	Kind    string          `json:"kind"`
	Role    string          `json:"role"`
	Payload json.RawMessage `json:"payload"`
}

type ConversationAppendInput struct {
	Target   ConversationTarget     `json:"target"`
	ThreadID string                 `json:"threadId,omitempty"`
	Entry    ConversationEntryInput `json:"entry"`
}

type ConversationCreateInput struct {
	Target ConversationTarget `json:"target"`
	Title  string             `json:"title"`
}

type ConversationRenameInput struct {
	ThreadID string `json:"threadId"`
	Title    string `json:"title"`
}

type ConversationArchiveInput struct {
	ThreadID string `json:"threadId"`
	Archived bool   `json:"archived"`
}

type ConversationEntry struct {
	ID        string          `json:"id"`
	ThreadID  string          `json:"threadId"`
	Ordinal   int             `json:"ordinal"`
	Kind      string          `json:"kind"`
	Role      string          `json:"role"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt string          `json:"createdAt"`
}

type ConversationThread struct {
	ID        string              `json:"id"`
	Target    ConversationTarget  `json:"target"`
	Title     string              `json:"title"`
	Entries   []ConversationEntry `json:"entries"`
	CreatedAt string              `json:"createdAt"`
	UpdatedAt string              `json:"updatedAt"`
}

type ConversationThreadSummary struct {
	ID        string             `json:"id"`
	Target    ConversationTarget `json:"target"`
	Title     string             `json:"title"`
	CreatedAt string             `json:"createdAt"`
	UpdatedAt string             `json:"updatedAt"`
}
