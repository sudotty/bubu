import { StateCreator } from 'zustand';
import { ConversationMessage } from '../../types/data';

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AISlice {
  // 状态
  conversations: Conversation[];
  currentConversation: string | null;
  aiLoading: boolean;
  aiError: string | null;
  
  // 操作
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  clearConversations: () => void;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  regenerateResponse: (conversationId: string, messageId: string) => Promise<void>;
}

export const aiSlice: StateCreator<AISlice> = (set, get) => ({
  // 初始状态
  conversations: [],
  currentConversation: null,
  aiLoading: false,
  aiError: null,
  
  // 操作函数
  setCurrentConversation: (id) => {
    set({ currentConversation: id });
    
    // 更新对话的活跃状态
    if (id) {
      set((state) => ({
        conversations: state.conversations.map(conv => ({
          ...conv,
          isActive: conv.id === id
        }))
      }));
    }
  },
  
  addMessage: (conversationId, message) => {
    const newMessage: ConversationMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    set((state) => ({
      conversations: state.conversations.map(conv => 
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              updatedAt: new Date()
            }
          : conv
      )
    }));
  },
  
  createConversation: (title) => {
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newConversation: Conversation = {
      id: newId,
      title: title || `对话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: false
    };
    
    set((state) => ({
      conversations: [newConversation, ...state.conversations]
    }));
    
    return newId;
  },
  
  deleteConversation: (id) => {
    set((state) => {
      const newConversations = state.conversations.filter(conv => conv.id !== id);
      const newCurrentConversation = state.currentConversation === id 
        ? (newConversations.length > 0 ? newConversations[0].id : null)
        : state.currentConversation;
      
      return {
        conversations: newConversations,
        currentConversation: newCurrentConversation
      };
    });
  },
  
  updateConversationTitle: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map(conv => 
        conv.id === id
          ? { ...conv, title, updatedAt: new Date() }
          : conv
      )
    }));
  },
  
  clearConversations: () => set({ 
    conversations: [], 
    currentConversation: null 
  }),
  
  sendMessage: async (conversationId, content) => {
    if (!content.trim()) return;
    
    set({ aiLoading: true, aiError: null });
    
    try {
      // 添加用户消息
      get().addMessage(conversationId, {
        type: 'user',
        content: content.trim()
      });
      
      // 这里应该调用实际的AI API
      // 暂时使用模拟响应
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockResponse = `这是对"${content}"的AI回复。这里会包含数据分析结果、图表配置或其他相关信息。`;
      
      // 添加AI响应
      get().addMessage(conversationId, {
        type: 'assistant',
        content: mockResponse
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI服务暂时不可用';
      set({ aiError: errorMessage });
      
      // 添加错误消息
      get().addMessage(conversationId, {
        type: 'error',
        content: `抱歉，处理您的请求时出现错误: ${errorMessage}`
      });
    } finally {
      set({ aiLoading: false });
    }
  },
  
  regenerateResponse: async (conversationId, messageId) => {
    set({ aiLoading: true, aiError: null });
    
    try {
      // 找到要重新生成的消息
      const conversation = get().conversations.find(conv => conv.id === conversationId);
      if (!conversation) return;
      
      const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;
      
      const userMessage = conversation.messages[messageIndex - 1]; // 假设前一条是用户消息
      if (!userMessage || userMessage.type !== 'user') return;
      
      // 模拟重新生成
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newResponse = `重新生成的回复: ${userMessage.content}。这是一个新的分析结果。`;
      
      // 更新消息
      set((state) => ({
        conversations: state.conversations.map(conv => 
          conv.id === conversationId
            ? {
                ...conv,
                messages: conv.messages.map(msg => 
                  msg.id === messageId
                    ? { ...msg, content: newResponse, timestamp: new Date() }
                    : msg
                ),
                updatedAt: new Date()
              }
            : conv
        )
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重新生成失败';
      set({ aiError: errorMessage });
    } finally {
      set({ aiLoading: false });
    }
  },
});