import { StateCreator } from 'zustand';

// 会话列表项类型
export interface ConversationListItem {
  id: number;
  title: string;
  updated_at: string;
  created_at: string;
  file_key: string;
  session_id: string;
}

// 会话选择器状态类型
export interface ConversationSelectorSlice {
  // 状态
  conversationList: ConversationListItem[];
  conversationLoading: boolean;
  
  // Actions
  setConversationList: (conversations: ConversationListItem[]) => void;
  setConversationLoading: (loading: boolean) => void;
  addConversationToList: (conversation: ConversationListItem) => void;
  clearConversationList: () => void;
  sortConversationsByTime: () => void;
}

// 创建会话选择器状态切片
export const conversationSelectorSlice: StateCreator<ConversationSelectorSlice> = (set, get) => ({
  // 初始状态
  conversationList: [],
  conversationLoading: false,
  
  // Actions
  setConversationList: (conversations: ConversationListItem[]) => {
    set({ conversationList: conversations });
  },
  
  setConversationLoading: (loading: boolean) => {
    set({ conversationLoading: loading });
  },
  
  addConversationToList: (conversation: ConversationListItem) => {
    const currentConversations = get().conversationList;
    const updatedConversations = [conversation, ...currentConversations];
    set({ conversationList: updatedConversations });
  },
  
  clearConversationList: () => {
    set({ conversationList: [] });
  },
  
  sortConversationsByTime: () => {
    const conversations = get().conversationList;
    const sortedConversations = [...conversations].sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    set({ conversationList: sortedConversations });
  }
});