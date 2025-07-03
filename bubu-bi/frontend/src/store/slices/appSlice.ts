import { StateCreator } from 'zustand';
import type { FileInfo } from '../../types';

// 应用级状态接口
export interface AppSlice {
  // 文件管理状态
  files: FileInfo[];
  selectedFiles: FileInfo[];
  isRefreshing: boolean;
  isProcessingFile: boolean;
  
  // UI 状态
  showAppSettings: boolean;
  showConversationSelector: boolean;
  
  // 会话状态
  currentConversationId: number | null;
  currentMessages: any[];
  analysisHistory: any[];
  
  // Actions - 文件管理
  setFiles: (files: FileInfo[]) => void;
  setSelectedFiles: (files: FileInfo[]) => void;
  addSelectedFile: (file: FileInfo) => void;
  removeSelectedFile: (file: FileInfo) => void;
  clearSelectedFiles: () => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setIsProcessingFile: (processing: boolean) => void;
  
  // Actions - UI 控制
  setShowAppSettings: (show: boolean) => void;
  setShowConversationSelector: (show: boolean) => void;
  
  // Actions - 会话管理
  setCurrentConversationId: (id: number | null) => void;
  setCurrentMessages: (messages: any[]) => void;
  addMessage: (message: any) => void;
  clearCurrentMessages: () => void;
  setAnalysisHistory: (history: any[]) => void;
  addToAnalysisHistory: (item: any) => void;
  
  // 组合操作
  selectFile: (file: FileInfo) => void;
  unselectFile: (file: FileInfo) => void;
  resetConversationState: () => void;
}

/**
 * 应用级状态管理 Slice
 * 整合了 App.tsx 中分散的 useState 状态
 * 提供统一的状态管理和操作方法
 */
export const appSlice: StateCreator<AppSlice> = (set, get) => ({
  // 初始状态
  files: [],
  selectedFiles: [],
  isRefreshing: false,
  isProcessingFile: false,
  showAppSettings: false,
  showConversationSelector: false,
  currentConversationId: null,
  currentMessages: [],
  analysisHistory: [],
  
  // 文件管理 Actions
  setFiles: (files) => set({ files }),
  
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  
  addSelectedFile: (file) => set((state) => {
    // 检查文件是否已存在
    const exists = state.selectedFiles.some(
      f => f.filename === file.filename && f.file_path === file.file_path
    );
    if (exists) return state;
    
    return {
      selectedFiles: [...state.selectedFiles, file]
    };
  }),
  
  removeSelectedFile: (file) => set((state) => ({
    selectedFiles: state.selectedFiles.filter(
      f => !(f.filename === file.filename && f.file_path === file.file_path)
    )
  })),
  
  clearSelectedFiles: () => set({ 
    selectedFiles: [],
    showConversationSelector: false,
    currentConversationId: null,
    currentMessages: []
  }),
  
  setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  
  setIsProcessingFile: (processing) => set({ isProcessingFile: processing }),
  
  // UI 控制 Actions
  setShowAppSettings: (show) => set({ showAppSettings: show }),
  
  setShowConversationSelector: (show) => set({ showConversationSelector: show }),
  
  // 会话管理 Actions
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  
  setCurrentMessages: (messages) => set({ currentMessages: messages }),
  
  addMessage: (message) => set((state) => ({
    currentMessages: [...state.currentMessages, message]
  })),
  
  clearCurrentMessages: () => set({ currentMessages: [] }),
  
  setAnalysisHistory: (history) => set({ analysisHistory: history }),
  
  addToAnalysisHistory: (item) => set((state) => ({
    analysisHistory: [...state.analysisHistory, item]
  })),
  
  // 组合操作 - 智能文件选择
  selectFile: (file) => set((state) => {
    const exists = state.selectedFiles.some(
      f => f.filename === file.filename && f.file_path === file.file_path
    );
    
    if (exists) {
      // 文件已选中，取消选择
      const newSelection = state.selectedFiles.filter(
        f => !(f.filename === file.filename && f.file_path === file.file_path)
      );
      
      return {
        selectedFiles: newSelection,
        // 如果没有选中文件了，重置会话状态
        ...(newSelection.length === 0 && {
          showConversationSelector: false,
          currentConversationId: null,
          currentMessages: []
        })
      };
    } else {
      // 文件未选中，添加到选择列表
      return {
        selectedFiles: [...state.selectedFiles, file]
        // 注意：会话检查逻辑需要在组件中处理，因为涉及异步操作
      };
    }
  }),
  
  // 取消选择文件
  unselectFile: (file) => set((state) => {
    const newSelection = state.selectedFiles.filter(
      f => !(f.filename === file.filename && f.file_path === file.file_path)
    );
    
    return {
      selectedFiles: newSelection,
      // 如果没有选中文件了，重置会话状态
      ...(newSelection.length === 0 && {
        showConversationSelector: false,
        currentConversationId: null,
        currentMessages: []
      })
    };
  }),
  
  // 重置会话状态
  resetConversationState: () => set({
    showConversationSelector: false,
    currentConversationId: null,
    currentMessages: []
  })
});