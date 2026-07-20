package rpc

import (
	"context"
	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) GetConversationByID(_ context.Context, threadID string) (*data.ConversationThread, error) {
	return &data.ConversationThread{ID: threadID, Entries: []data.ConversationEntry{}}, nil
}
func (fake *fakeDatasets) ListConversations(_ context.Context, target data.ConversationTarget, _ bool) ([]data.ConversationThreadSummary, error) {
	return []data.ConversationThreadSummary{{ID: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", Target: target, Title: "测试对话"}}, nil
}
func (fake *fakeDatasets) CreateConversation(_ context.Context, input data.ConversationCreateInput) (*data.ConversationThread, error) {
	return &data.ConversationThread{ID: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", Target: input.Target, Title: input.Title, Entries: []data.ConversationEntry{}}, nil
}
func (fake *fakeDatasets) RenameConversation(_ context.Context, input data.ConversationRenameInput) (*data.ConversationThread, error) {
	return &data.ConversationThread{ID: input.ThreadID, Title: input.Title, Entries: []data.ConversationEntry{}}, nil
}
func (fake *fakeDatasets) ArchiveConversation(context.Context, data.ConversationArchiveInput) error {
	return nil
}
