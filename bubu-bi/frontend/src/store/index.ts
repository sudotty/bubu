import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { dataSlice, DataSlice } from './slices/dataSlice';
import { uiSlice, UISlice } from './slices/uiSlice';
import { querySlice, QuerySlice } from './slices/querySlice';
import { aiSlice, AISlice } from './slices/aiSlice';
import { appSlice, AppSlice } from './slices/appSlice';

// 组合所有slice的类型
export type AppStore = DataSlice & UISlice & QuerySlice & AISlice & AppSlice;

// 创建主store
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        (...args) => ({
          ...dataSlice(...args),
          ...uiSlice(...args),
          ...querySlice(...args),
          ...aiSlice(...args),
          ...appSlice(...args),
        })
      ),
      {
        name: 'bubu-bi-store',
        // 只持久化部分状态，避免存储过大
        partialize: (state: AppStore) => ({
          // UI偏好设置
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          // 查询历史（限制数量）
          queryHistory: state.queryHistory?.slice(-50) || [],
          // 会话历史（限制数量）
          conversations: state.conversations?.slice(-10) || [],
          // 移除了表格相关的持久化状态
        }),
        // 版本控制，用于数据迁移
        version: 1,
      }
    ),
    {
      name: 'bubu-bi-store',
      enabled: import.meta.env.DEV, // 只在开发环境启用devtools
    }
  )
);

// 优化的选择器函数，使用 shallow 比较避免不必要的重渲染

// 数据状态选择器 - 分离状态和操作
export const useDataState = () => useAppStore(
  (state) => ({
    currentData: state.currentData,
    dataHistory: state.dataHistory,
    loading: state.loading,
    error: state.error,
  }),
  shallow
);

export const useDataActions = () => useAppStore(
  (state) => ({
    setCurrentData: state.setCurrentData,
    addToHistory: state.addToHistory,
    clearData: state.clearData,
    fetchData: state.fetchData,
  }),
  shallow
);

// 兼容性：保留原有的 useDataStore
export const useDataStore = () => useAppStore((state) => ({
  currentData: state.currentData,
  dataHistory: state.dataHistory,
  loading: state.loading,
  error: state.error,
  setCurrentData: state.setCurrentData,
  addToHistory: state.addToHistory,
  clearData: state.clearData,
  fetchData: state.fetchData,
}));

// UI 状态选择器 - 分离状态和操作
export const useUIState = () => useAppStore(
  (state) => ({
    theme: state.theme,
    sidebarOpen: state.sidebarOpen,
    modalOpen: state.modalOpen,
    notifications: state.notifications,
    loading: state.loading,
  }),
  shallow
);

export const useUIActions = () => useAppStore(
  (state) => ({
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
    setSidebarOpen: state.setSidebarOpen,
    openModal: state.openModal,
    closeModal: state.closeModal,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    clearNotifications: state.clearNotifications,
    setLoading: state.setLoading,
  }),
  shallow
);

// 兼容性：保留原有的 useUIStore
export const useUIStore = () => useAppStore((state) => ({
  theme: state.theme,
  sidebarOpen: state.sidebarOpen,
  modalOpen: state.modalOpen,
  notifications: state.notifications,
  loading: state.loading,
  setTheme: state.setTheme,
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
  openModal: state.openModal,
  closeModal: state.closeModal,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  clearNotifications: state.clearNotifications,
  setLoading: state.setLoading,
}));

// 查询状态选择器 - 分离状态和操作
export const useQueryState = () => useAppStore(
  (state) => ({
    currentQuery: state.currentQuery,
    queryHistory: state.queryHistory,
    queryMode: state.queryMode,
    suggestions: state.suggestions,
    isExecuting: state.isExecuting,
  }),
  shallow
);

export const useQueryActions = () => useAppStore(
  (state) => ({
    setCurrentQuery: state.setCurrentQuery,
    addToQueryHistory: state.addToQueryHistory,
    clearQueryHistory: state.clearQueryHistory,
    setQueryMode: state.setQueryMode,
    setSuggestions: state.setSuggestions,
    executeQuery: state.executeQuery,
    generateSuggestions: state.generateSuggestions,
  }),
  shallow
);

// 兼容性：保留原有的 useQueryStore
export const useQueryStore = () => useAppStore((state) => ({
  currentQuery: state.currentQuery,
  queryHistory: state.queryHistory,
  queryMode: state.queryMode,
  suggestions: state.suggestions,
  isExecuting: state.isExecuting,
  setCurrentQuery: state.setCurrentQuery,
  addToQueryHistory: state.addToQueryHistory,
  clearQueryHistory: state.clearQueryHistory,
  setQueryMode: state.setQueryMode,
  setSuggestions: state.setSuggestions,
  executeQuery: state.executeQuery,
  generateSuggestions: state.generateSuggestions,
}));

// AI 状态选择器 - 分离状态和操作
export const useAIState = () => useAppStore(
  (state) => ({
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    aiLoading: state.aiLoading,
    aiError: state.aiError,
  }),
  shallow
);

export const useAIActions = () => useAppStore(
  (state) => ({
    setCurrentConversation: state.setCurrentConversation,
    addMessage: state.addMessage,
    createConversation: state.createConversation,
    deleteConversation: state.deleteConversation,
    updateConversationTitle: state.updateConversationTitle,
    clearConversations: state.clearConversations,
    sendMessage: state.sendMessage,
    regenerateResponse: state.regenerateResponse,
  }),
  shallow
);

// 兼容性：保留原有的 useAIStore
export const useAIStore = () => useAppStore((state) => ({
  conversations: state.conversations,
  currentConversation: state.currentConversation,
  aiLoading: state.aiLoading,
  aiError: state.aiError,
  setCurrentConversation: state.setCurrentConversation,
  addMessage: state.addMessage,
  createConversation: state.createConversation,
  deleteConversation: state.deleteConversation,
  updateConversationTitle: state.updateConversationTitle,
  clearConversations: state.clearConversations,
  sendMessage: state.sendMessage,
  regenerateResponse: state.regenerateResponse,
}));

// 移除了表格状态选择器

// 导出类型
export type { DataSlice, UISlice, QuerySlice, AISlice };
export type { QueryResult } from './slices/dataSlice';
export type { Notification } from './slices/uiSlice';
export type { QuerySuggestion } from './slices/querySlice';
export type { Conversation } from './slices/aiSlice';