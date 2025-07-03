import { useState, useCallback } from 'react';
import { useAIStore, useUIStore } from '../../store';
import {
  CreateConversation,
  GetConversation,
  GetConversationsByFiles,
  UpdateConversationTitle,
  SaveConversationMessage,
  GetConversationMessages,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';

type BackendConversation = main.Conversation;
type BackendConversationMessage = main.ConversationMessage;

export interface ConversationOptions {
  selectedFiles?: string[];
  autoSave?: boolean;
  maxMessages?: number;
}

export interface ConversationResult {
  loading: boolean;
  error: string | null;
  createConversation: (title: string, fileKey: string, sessionId: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  loadConversationsByFiles: (files: string[]) => Promise<void>;
  updateTitle: (conversationId: string, title: string) => Promise<void>;
  saveMessage: (conversationId: number, messageType: string, content: string, sql?: string) => Promise<void>;
  loadMessages: (conversationId: number) => Promise<void>;
}

/**
 * 统一对话管理Hook - 合并对话相关功能
 * 支持创建、加载、更新对话，以及消息管理
 */
export const useConversation = (options: ConversationOptions = {}): ConversationResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    addMessage,
    createConversation: storeCreateConversation,
    updateConversationTitle: storeUpdateTitle
  } = useAIStore();
  
  const { addNotification } = useUIStore();
  
  const createConversation = useCallback(async (
    title: string,
    fileKey: string,
    sessionId: string
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const backendConversation: BackendConversation = await CreateConversation(
        title,
        fileKey,
        sessionId
      );
      
      // 转换为前端格式并存储
      const conversation = {
        id: backendConversation.id.toString(),
        title: backendConversation.title,
        fileKey: backendConversation.file_key,
        sessionId: backendConversation.session_id,
        createdAt: new Date(backendConversation.created_at),
        updatedAt: new Date(backendConversation.updated_at),
        messages: []
      };
      
      const conversationId = storeCreateConversation(conversation.title);
      setCurrentConversation(conversationId);
      
      addNotification({
        type: 'success',
        title: '对话创建成功',
        message: `已创建对话: ${title}`,
        duration: 3000
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建对话失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '创建对话失败',
        message: errorMessage,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [storeCreateConversation, setCurrentConversation, addNotification]);
  
  const loadConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const backendConversation: BackendConversation = await GetConversation(conversationId);
      
      const conversation = {
        id: backendConversation.id.toString(),
        title: backendConversation.title,
        fileKey: backendConversation.file_key,
        sessionId: backendConversation.session_id,
        createdAt: new Date(backendConversation.created_at),
        updatedAt: new Date(backendConversation.updated_at),
        messages: []
      };
      
      setCurrentConversation(conversation.id);
      
      // 加载消息
      await loadMessages(backendConversation.id);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载对话失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '加载对话失败',
        message: errorMessage,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [setCurrentConversation, addNotification]);
  
  const loadConversationsByFiles = useCallback(async (files: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const backendConversations: BackendConversation[] = await GetConversationsByFiles(files);
      
      // 转换并存储所有对话
      backendConversations.forEach(backendConv => {
        const conversation = {
          id: backendConv.id.toString(),
          title: backendConv.title,
          fileKey: backendConv.file_key,
          sessionId: backendConv.session_id,
          createdAt: new Date(backendConv.created_at),
          updatedAt: new Date(backendConv.updated_at),
          messages: []
        };
        
        const conversationId = storeCreateConversation(conversation.title);
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载对话列表失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '加载对话列表失败',
        message: errorMessage,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [storeCreateConversation, addNotification]);
  
  const updateTitle = useCallback(async (conversationId: string, title: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await UpdateConversationTitle(conversationId, title);
      storeUpdateTitle(conversationId, title);
      
      addNotification({
        type: 'success',
        title: '标题更新成功',
        message: `已更新为: ${title}`,
        duration: 3000
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新标题失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '更新标题失败',
        message: errorMessage,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [storeUpdateTitle, addNotification]);
  
  const saveMessage = useCallback(async (
    conversationId: number,
    messageType: string,
    content: string,
    sql?: string
  ) => {
    try {
      await SaveConversationMessage(
        conversationId,
        messageType,
        content,
        sql || '',
        '', // queryResult
        '', // insights
        '', // suggestions
        ''  // debugInfo
      );
      
      // 添加到本地状态
      const message = {
        id: Date.now().toString(),
        type: messageType as 'user' | 'assistant',
        content,
        timestamp: new Date(),
        sql
      };
      
      addMessage(conversationId.toString(), message);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存消息失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '保存消息失败',
        message: errorMessage,
        duration: 5000
      });
    }
  }, [addMessage, addNotification]);
  
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const backendMessages: BackendConversationMessage[] = await GetConversationMessages(conversationId);
      
      // 转换并添加消息
      backendMessages.forEach(backendMsg => {
        const message = {
          id: backendMsg.id.toString(),
          type: backendMsg.message_type as 'user' | 'assistant',
          content: backendMsg.content,
          timestamp: new Date(backendMsg.created_at),
          sql: backendMsg.sql
        };
        
        addMessage(conversationId.toString(), message);
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载消息失败';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '加载消息失败',
        message: errorMessage,
        duration: 5000
      });
    }
  }, [addMessage, addNotification]);
  
  return {
    loading,
    error,
    createConversation,
    loadConversation,
    loadConversationsByFiles,
    updateTitle,
    saveMessage,
    loadMessages
  };
};