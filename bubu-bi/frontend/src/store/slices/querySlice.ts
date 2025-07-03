import { StateCreator } from 'zustand';

export interface QuerySuggestion {
  id: string;
  text: string;
  type: 'template' | 'history' | 'ai';
  category?: string;
  description?: string;
}

export interface QuerySlice {
  // 状态
  currentQuery: string;
  queryHistory: string[];
  queryMode: 'natural' | 'sql' | 'hybrid';
  suggestions: QuerySuggestion[];
  isExecuting: boolean;
  
  // 操作
  setCurrentQuery: (query: string) => void;
  addToQueryHistory: (query: string) => void;
  clearQueryHistory: () => void;
  setQueryMode: (mode: 'natural' | 'sql' | 'hybrid') => void;
  setSuggestions: (suggestions: QuerySuggestion[]) => void;
  executeQuery: (query: string) => Promise<void>;
  generateSuggestions: (input: string) => void;
}

export const querySlice: StateCreator<QuerySlice> = (set, get) => ({
  // 初始状态
  currentQuery: '',
  queryHistory: [],
  queryMode: 'natural',
  suggestions: [],
  isExecuting: false,
  
  // 操作函数
  setCurrentQuery: (query) => {
    set({ currentQuery: query });
    // 当查询改变时，生成建议
    if (query.trim()) {
      get().generateSuggestions(query);
    } else {
      set({ suggestions: [] });
    }
  },
  
  addToQueryHistory: (query) => {
    if (!query.trim()) return;
    
    set((state) => {
      const newHistory = [query, ...state.queryHistory.filter(q => q !== query)];
      return {
        queryHistory: newHistory.slice(0, 20) // 保留最近20条记录
      };
    });
  },
  
  clearQueryHistory: () => set({ queryHistory: [] }),
  
  setQueryMode: (mode) => set({ queryMode: mode }),
  
  setSuggestions: (suggestions) => set({ suggestions }),
  
  executeQuery: async (query) => {
    if (!query.trim()) return;
    
    set({ isExecuting: true });
    
    try {
      // 添加到历史记录
      get().addToQueryHistory(query);
      
      // 这里应该调用实际的查询API
      // 暂时使用模拟延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 清空当前查询
      set({ currentQuery: '', suggestions: [] });
      
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    } finally {
      set({ isExecuting: false });
    }
  },
  
  generateSuggestions: (input) => {
    const { queryHistory, queryMode } = get();
    const suggestions: QuerySuggestion[] = [];
    
    // 从历史记录生成建议
    const historyMatches = queryHistory
      .filter(q => q.toLowerCase().includes(input.toLowerCase()))
      .slice(0, 3)
      .map((query, index) => ({
        id: `history-${index}`,
        text: query,
        type: 'history' as const,
        category: '历史查询'
      }));
    
    suggestions.push(...historyMatches);
    
    // 根据查询模式生成模板建议
    if (queryMode === 'natural') {
      const naturalTemplates = [
        '显示所有数据',
        '按照...分组统计',
        '查找包含...的记录',
        '计算...的平均值',
        '显示最近的...条记录'
      ].filter(template => 
        template.toLowerCase().includes(input.toLowerCase())
      ).map((template, index) => ({
        id: `natural-${index}`,
        text: template,
        type: 'template' as const,
        category: '自然语言模板'
      }));
      
      suggestions.push(...naturalTemplates);
    } else if (queryMode === 'sql') {
      const sqlTemplates = [
        'SELECT * FROM table',
        'SELECT COUNT(*) FROM table',
        'SELECT column FROM table WHERE condition',
        'SELECT column, COUNT(*) FROM table GROUP BY column',
        'SELECT * FROM table ORDER BY column DESC LIMIT 10'
      ].filter(template => 
        template.toLowerCase().includes(input.toLowerCase())
      ).map((template, index) => ({
        id: `sql-${index}`,
        text: template,
        type: 'template' as const,
        category: 'SQL模板'
      }));
      
      suggestions.push(...sqlTemplates);
    }
    
    set({ suggestions: suggestions.slice(0, 8) }); // 最多显示8个建议
  },
});