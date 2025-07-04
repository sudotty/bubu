import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import { dataSlice, type DataSlice } from './slices/dataSlice';
import { uiSlice, type UISlice } from './slices/uiSlice';
import { querySlice, type QuerySlice } from './slices/querySlice';
import { aiSlice, type AISlice } from './slices/aiSlice';
import { appSlice, type AppSlice } from './slices/appSlice';
import { smartInputSlice, type SmartInputSlice } from './slices/smartInputSlice';
import { conversationSlice } from './slices/conversationSlice';
import { conversationSelectorSlice } from './slices/conversationSelectorSlice';
import { createFilePanelSlice } from './slices/filePanelSlice';
import type { ConversationSlice } from './slices/conversationSlice';
import type { ConversationSelectorSlice } from './slices/conversationSelectorSlice';
import type { FilePanelSlice } from './slices/filePanelSlice';

// 组合所有slice的类型
export type AppStore = DataSlice & UISlice & QuerySlice & AISlice & AppSlice & SmartInputSlice & ConversationSlice & ConversationSelectorSlice & FilePanelSlice;

// 创建主store
export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    (...args) => ({
      ...dataSlice(...args),
      ...uiSlice(...args),
      ...querySlice(...args),
      ...aiSlice(...args),
      ...appSlice(...args),
      ...smartInputSlice(...args),
      ...conversationSlice(...args),
      ...conversationSelectorSlice(...args),
      ...createFilePanelSlice(...args),
    })
  )
);

// 优化的选择器函数，使用 shallow 比较避免不必要的重渲染

// 数据状态选择器 - 分离状态和操作
export const useDataState = () => useAppStore(
  useShallow((state) => ({
    currentData: state.currentData,
    dataHistory: state.dataHistory,
    loading: state.loading,
    error: state.error,
  }))
);

export const useDataActions = () => useAppStore(
  useShallow((state) => ({
    setCurrentData: state.setCurrentData,
    addToHistory: state.addToHistory,
    clearData: state.clearData,
    fetchData: state.fetchData,
  }))
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
  useShallow((state) => ({
    theme: state.theme,
    sidebarOpen: state.sidebarOpen,
    modalOpen: state.modalOpen,
    notifications: state.notifications,
    loading: state.loading,
  }))
);

export const useUIActions = () => useAppStore(
  useShallow((state) => ({
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
    setSidebarOpen: state.setSidebarOpen,
    openModal: state.openModal,
    closeModal: state.closeModal,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    clearNotifications: state.clearNotifications,
    setLoading: state.setLoading,
  }))
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
  useShallow((state) => ({
    currentQuery: state.currentQuery,
    queryHistory: state.queryHistory,
    queryMode: state.queryMode,
    suggestions: state.suggestions,
    isExecuting: state.isExecuting,
  }))
);

export const useQueryActions = () => useAppStore(
  useShallow((state) => ({
    setCurrentQuery: state.setCurrentQuery,
    addToQueryHistory: state.addToQueryHistory,
    clearQueryHistory: state.clearQueryHistory,
    setQueryMode: state.setQueryMode,
    setSuggestions: state.setSuggestions,
    executeQuery: state.executeQuery,
    generateSuggestions: state.generateSuggestions,
  }))
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
  useShallow((state) => ({
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    aiLoading: state.aiLoading,
    aiError: state.aiError,
  }))
);

export const useAIActions = () => useAppStore(
  useShallow((state) => ({
    setCurrentConversation: state.setCurrentConversation,
    addMessage: state.addMessage,
    createConversation: state.createConversation,
    deleteConversation: state.deleteConversation,
    updateConversationTitle: state.updateConversationTitle,
    clearConversations: state.clearConversations,
    sendMessage: state.sendMessage,
    regenerateResponse: state.regenerateResponse,
  }))
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

// 应用级状态选择器 - 新增的 appSlice
export const useAppState = () => useAppStore(
  useShallow((state) => ({
    files: state.files,
    selectedFiles: state.selectedFiles,
    isRefreshing: state.isRefreshing,
    isProcessingFile: state.isProcessingFile,
    showAppSettings: state.showAppSettings,
    showConversationSelector: state.showConversationSelector,
    currentConversationId: state.currentConversationId,
    currentMessages: state.currentMessages,
    analysisHistory: state.analysisHistory,
  }))
);

export const useAppActions = () => useAppStore(
  useShallow((state) => ({
    setFiles: state.setFiles,
    setSelectedFiles: state.setSelectedFiles,
    addSelectedFile: state.addSelectedFile,
    removeSelectedFile: state.removeSelectedFile,
    clearSelectedFiles: state.clearSelectedFiles,
    setIsRefreshing: state.setIsRefreshing,
    setIsProcessingFile: state.setIsProcessingFile,
    setShowAppSettings: state.setShowAppSettings,
    setShowConversationSelector: state.setShowConversationSelector,
    setCurrentConversationId: state.setCurrentConversationId,
    setCurrentMessages: state.setCurrentMessages,
    addMessage: state.addMessage,
    clearCurrentMessages: state.clearCurrentMessages,
    setAnalysisHistory: state.setAnalysisHistory,
    addToAnalysisHistory: state.addToAnalysisHistory,
    selectFile: state.selectFile,
    unselectFile: state.unselectFile,
    resetConversationState: state.resetConversationState,
  }))
);

// 组合选择器 - 提供常用的状态组合
export const useFileManagement = () => useAppStore(
  useShallow((state) => ({
    files: state.files,
    selectedFiles: state.selectedFiles,
    isRefreshing: state.isRefreshing,
    isProcessingFile: state.isProcessingFile,
    setFiles: state.setFiles,
    selectFile: state.selectFile,
    unselectFile: state.unselectFile,
    clearSelectedFiles: state.clearSelectedFiles,
    setIsRefreshing: state.setIsRefreshing,
    setIsProcessingFile: state.setIsProcessingFile,
  }))
);

export const useConversationManagement = () => useAppStore(
  useShallow((state) => ({
    showConversationSelector: state.showConversationSelector,
    currentConversationId: state.currentConversationId,
    currentMessages: state.currentMessages,
    setShowConversationSelector: state.setShowConversationSelector,
    setCurrentConversationId: state.setCurrentConversationId,
    setCurrentMessages: state.setCurrentMessages,
    resetConversationState: state.resetConversationState,
  }))
);

// SmartInput 状态选择器 - 分离状态和操作
export const useSmartInputState = () => useAppStore(
  useShallow((state) => ({
    currentMode: state.currentMode,
    showSuggestionsPanel: state.showSuggestionsPanel,
    activeTab: state.activeTab,
  }))
);

export const useSmartInputActions = () => useAppStore(
  useShallow((state) => ({
    setCurrentMode: state.setCurrentMode,
    toggleMode: state.toggleMode,
    setShowSuggestionsPanel: state.setShowSuggestionsPanel,
    toggleSuggestionsPanel: state.toggleSuggestionsPanel,
    setActiveTab: state.setActiveTab,
    closeSuggestionsPanel: state.closeSuggestionsPanel,
    openSuggestionsPanel: state.openSuggestionsPanel,
  }))
);

// 兼容性：保留原有的 useSmartInputStore
export const useSmartInputStore = () => useAppStore((state) => ({
  currentMode: state.currentMode,
  showSuggestionsPanel: state.showSuggestionsPanel,
  activeTab: state.activeTab,
  setCurrentMode: state.setCurrentMode,
  toggleMode: state.toggleMode,
  setShowSuggestionsPanel: state.setShowSuggestionsPanel,
  toggleSuggestionsPanel: state.toggleSuggestionsPanel,
  setActiveTab: state.setActiveTab,
  closeSuggestionsPanel: state.closeSuggestionsPanel,
  openSuggestionsPanel: state.openSuggestionsPanel,
}));

// SmartInput 组合选择器
export const useSmartInput = () => useAppStore(
  useShallow((state) => ({
    currentMode: state.currentMode,
    showSuggestionsPanel: state.showSuggestionsPanel,
    activeTab: state.activeTab,
    setCurrentMode: state.setCurrentMode,
    toggleMode: state.toggleMode,
    setShowSuggestionsPanel: state.setShowSuggestionsPanel,
    toggleSuggestionsPanel: state.toggleSuggestionsPanel,
    setActiveTab: state.setActiveTab,
    closeSuggestionsPanel: state.closeSuggestionsPanel,
    openSuggestionsPanel: state.openSuggestionsPanel,
  }))
);

// Conversation 选择器
export const useConversationState = () => useAppStore(
  useShallow(state => ({
    input: state.input,
    globalDebugMode: state.globalDebugMode
  }))
);

export const useConversationActions = () => useAppStore(
  useShallow(state => ({
    setInput: state.setInput,
    clearInput: state.clearInput,
    setGlobalDebugMode: state.setGlobalDebugMode,
    toggleDebugMode: state.toggleDebugMode
  }))
);

// 组合选择器
export const useConversation = () => useAppStore(
  useShallow(state => ({
    // 状态
    input: state.input,
    globalDebugMode: state.globalDebugMode,
    // Actions
    setInput: state.setInput,
    clearInput: state.clearInput,
    setGlobalDebugMode: state.setGlobalDebugMode,
    toggleDebugMode: state.toggleDebugMode
  }))
);

// ConversationSelector 选择器
export const useConversationSelectorState = () => useAppStore(
  useShallow(state => ({
    conversationList: state.conversationList,
    conversationLoading: state.conversationLoading
  }))
);

export const useConversationSelectorActions = () => useAppStore(
  useShallow(state => ({
    setConversationList: state.setConversationList,
    setConversationLoading: state.setConversationLoading,
    addConversationToList: state.addConversationToList,
    clearConversationList: state.clearConversationList,
    sortConversationsByTime: state.sortConversationsByTime
  }))
);

// 组合选择器
export const useConversationSelector = () => useAppStore(
  useShallow(state => ({
    // 状态
    conversationList: state.conversationList,
    conversationLoading: state.conversationLoading,
    // Actions
    setConversationList: state.setConversationList,
    setConversationLoading: state.setConversationLoading,
    addConversationToList: state.addConversationToList,
    clearConversationList: state.clearConversationList,
    sortConversationsByTime: state.sortConversationsByTime
  }))
);

// FilePanel 选择器
export const useFilePanelState = () => useAppStore(
  useShallow(state => ({
    localIsRefreshing: state.localIsRefreshing
  }))
);

export const useFilePanelActions = () => useAppStore(
  useShallow(state => ({
    setLocalIsRefreshing: state.setLocalIsRefreshing,
    startLocalRefresh: state.startLocalRefresh,
    endLocalRefresh: state.endLocalRefresh
  }))
);

// 组合选择器
export const useFilePanel = () => useAppStore(
  useShallow(state => ({
    // 状态
    localIsRefreshing: state.localIsRefreshing,
    // Actions
    setLocalIsRefreshing: state.setLocalIsRefreshing,
    startLocalRefresh: state.startLocalRefresh,
    endLocalRefresh: state.endLocalRefresh
  }))
);

// 导出类型
export type { DataSlice, UISlice, QuerySlice, AISlice, AppSlice, SmartInputSlice, ConversationSlice, ConversationSelectorSlice, FilePanelSlice };
export type { QueryResult } from './slices/dataSlice';
export type { Notification } from './slices/uiSlice';
export type { QuerySuggestion } from './slices/querySlice';
export type { Conversation } from './slices/aiSlice';
export type { ConversationListItem } from './slices/conversationSelectorSlice';
export type { FileInfo } from '../types';