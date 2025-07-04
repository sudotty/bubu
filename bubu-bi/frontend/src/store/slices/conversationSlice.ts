import { StateCreator } from 'zustand';

// 对话界面状态类型
export interface ConversationSlice {
  // 输入状态
  input: string;
  globalDebugMode: boolean;
  
  // Actions
  setInput: (input: string) => void;
  clearInput: () => void;
  setGlobalDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
}

// 创建对话界面状态切片
export const conversationSlice: StateCreator<ConversationSlice> = (set, get) => ({
  // 初始状态
  input: '',
  globalDebugMode: (() => {
    // 从localStorage和URL参数初始化调试模式
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bubu-debug-mode') === 'true' || 
             window.location.search.includes('debug=true');
    }
    return false;
  })(),
  
  // Actions
  setInput: (input: string) => {
    set({ input });
  },
  
  clearInput: () => {
    set({ input: '' });
  },
  
  setGlobalDebugMode: (enabled: boolean) => {
    set({ globalDebugMode: enabled });
    // 同步到localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('bubu-debug-mode', enabled.toString());
    }
  },
  
  toggleDebugMode: () => {
    const currentMode = get().globalDebugMode;
    const newMode = !currentMode;
    set({ globalDebugMode: newMode });
    // 同步到localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('bubu-debug-mode', newMode.toString());
    }
  }
});