import { StateCreator } from 'zustand';

// 输入模式类型 - 与 SmartInput 组件保持一致
export type InputMode = 'natural' | 'sql' | 'mixed';

// SmartInput 组件状态接口
export interface SmartInputSlice {
  // 输入模式状态
  currentMode: InputMode;
  
  // 建议面板状态
  showSuggestionsPanel: boolean;
  activeTab: 'suggestions' | 'history' | 'templates';
  
  // Actions - 模式管理
  setCurrentMode: (mode: InputMode) => void;
  toggleMode: () => void;
  
  // Actions - 建议面板管理
  setShowSuggestionsPanel: (show: boolean) => void;
  toggleSuggestionsPanel: () => void;
  setActiveTab: (tab: 'suggestions' | 'history' | 'templates') => void;
  
  // 组合操作
  closeSuggestionsPanel: () => void;
  openSuggestionsPanel: (tab?: 'suggestions' | 'history' | 'templates') => void;
}

/**
 * SmartInput 组件状态管理 Slice
 * 管理输入模式、建议面板显示状态和活跃标签页
 * 提供统一的状态管理和操作方法
 */
export const smartInputSlice: StateCreator<SmartInputSlice> = (set, get) => ({
  // 初始状态
  currentMode: 'natural',
  showSuggestionsPanel: false,
  activeTab: 'suggestions',
  
  // 模式管理 Actions
  setCurrentMode: (mode) => set({ currentMode: mode }),
  
  toggleMode: () => set((state) => {
    // 循环切换模式：natural -> sql -> mixed -> natural
    const modes: InputMode[] = ['natural', 'sql', 'mixed'];
    const currentIndex = modes.indexOf(state.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    return { currentMode: modes[nextIndex] };
  }),
  
  // 建议面板管理 Actions
  setShowSuggestionsPanel: (show) => set({ showSuggestionsPanel: show }),
  
  toggleSuggestionsPanel: () => set((state) => ({
    showSuggestionsPanel: !state.showSuggestionsPanel
  })),
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // 组合操作
  closeSuggestionsPanel: () => set({ 
    showSuggestionsPanel: false 
  }),
  
  openSuggestionsPanel: (tab = 'suggestions') => set({ 
    showSuggestionsPanel: true,
    activeTab: tab
  })
});