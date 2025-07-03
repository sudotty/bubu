import { StateCreator } from 'zustand';
import type { QueryResult } from '../../types/data';

// 简化的数据状态管理
export interface DataSlice {
  // 状态
  currentData: QueryResult | null;
  dataHistory: QueryResult[];
  loading: boolean;
  error: string | null;
  
  // 操作
  setCurrentData: (data: QueryResult | null) => void;
  addToHistory: (data: QueryResult) => void;
  clearData: () => void;
  fetchData: (query: string) => Promise<void>;
}

// 导出QueryResult类型以供其他文件使用
export type { QueryResult };

export const dataSlice: StateCreator<DataSlice> = (set, get) => ({
  // 初始状态
  currentData: null,
  dataHistory: [],
  loading: false,
  error: null,
  
  // 操作函数
  setCurrentData: (data) => set({ currentData: data }),
  
  addToHistory: (data) => set((state) => ({
    dataHistory: [data, ...state.dataHistory.slice(0, 9)] // 保留最近10条记录
  })),
  
  clearData: () => set({ 
    currentData: null,
    error: null 
  }),
  
  fetchData: async (query) => {
    set({ loading: true, error: null });
    try {
      // 这里应该调用实际的API
      console.log('Fetching data for query:', query);
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      set({ loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
});