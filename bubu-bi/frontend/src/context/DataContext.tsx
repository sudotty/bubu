import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { TableData, ChartConfig, DataInsight, ConversationMessage } from '../types/data';

// 应用状态接口
export interface AppState {
  // 当前数据
  currentData: TableData | null;
  
  // 对话历史
  messages: ConversationMessage[];
  
  // UI状态
  ui: {
    isLoading: boolean;
    error: string | null;
    activeView: 'table' | 'chart' | 'insights' | 'chat';
    sidebarOpen: boolean;
    fullscreenMode: boolean;
  };
  
  // 图表状态
  chart: {
    config: ChartConfig | null;
    type: string;
    selectedColumns: string[];
  };
  
  // 过滤和排序状态
  filters: {
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    filterConfig: { column: string; value: string } | null;
    searchQuery: string;
  };
  
  // 洞察状态
  insights: {
    data: DataInsight[];
    selectedInsight: DataInsight | null;
  };
  
  // 缓存状态
  cache: {
    queries: Map<string, TableData>;
    lastQueryTime: number;
  };
}

// 动作类型
export type AppAction =
  // 数据相关动作
  | { type: 'SET_DATA'; payload: TableData }
  | { type: 'CLEAR_DATA' }
  
  // 消息相关动作
  | { type: 'ADD_MESSAGE'; payload: ConversationMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ConversationMessage> } }
  | { type: 'CLEAR_MESSAGES' }
  
  // UI状态动作
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_VIEW'; payload: 'table' | 'chart' | 'insights' | 'chat' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_FULLSCREEN'; payload: boolean }
  
  // 图表相关动作
  | { type: 'SET_CHART_CONFIG'; payload: ChartConfig }
  | { type: 'SET_CHART_TYPE'; payload: string }
  | { type: 'SET_SELECTED_COLUMNS'; payload: string[] }
  
  // 过滤和排序动作
  | { type: 'SET_SORT'; payload: { key: string; direction: 'asc' | 'desc' } | null }
  | { type: 'SET_FILTER'; payload: { column: string; value: string } | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'RESET_FILTERS' }
  
  // 洞察相关动作
  | { type: 'SET_INSIGHTS'; payload: DataInsight[] }
  | { type: 'SELECT_INSIGHT'; payload: DataInsight | null }
  
  // 缓存相关动作
  | { type: 'CACHE_QUERY'; payload: { key: string; data: TableData } }
  | { type: 'CLEAR_CACHE' };

// 初始状态
const initialState: AppState = {
  currentData: null,
  messages: [],
  ui: {
    isLoading: false,
    error: null,
    activeView: 'chat',
    sidebarOpen: true,
    fullscreenMode: false
  },
  chart: {
    config: null,
    type: 'bar',
    selectedColumns: []
  },
  filters: {
    sortConfig: null,
    filterConfig: null,
    searchQuery: ''
  },
  insights: {
    data: [],
    selectedInsight: null
  },
  cache: {
    queries: new Map(),
    lastQueryTime: 0
  }
};

// Reducer函数
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    // 数据相关
    case 'SET_DATA':
      return {
        ...state,
        currentData: action.payload,
        ui: { ...state.ui, error: null }
      };
    
    case 'CLEAR_DATA':
      return {
        ...state,
        currentData: null,
        chart: { ...state.chart, config: null },
        insights: { ...state.insights, data: [] }
      };
    
    // 消息相关
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };
    
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: []
      };
    
    // UI状态
    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload }
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: action.payload, isLoading: false }
      };
    
    case 'SET_ACTIVE_VIEW':
      return {
        ...state,
        ui: { ...state.ui, activeView: action.payload }
      };
    
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen }
      };
    
    case 'SET_FULLSCREEN':
      return {
        ...state,
        ui: { ...state.ui, fullscreenMode: action.payload }
      };
    
    // 图表相关
    case 'SET_CHART_CONFIG':
      return {
        ...state,
        chart: { ...state.chart, config: action.payload }
      };
    
    case 'SET_CHART_TYPE':
      return {
        ...state,
        chart: { ...state.chart, type: action.payload }
      };
    
    case 'SET_SELECTED_COLUMNS':
      return {
        ...state,
        chart: { ...state.chart, selectedColumns: action.payload }
      };
    
    // 过滤和排序
    case 'SET_SORT':
      return {
        ...state,
        filters: { ...state.filters, sortConfig: action.payload }
      };
    
    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, filterConfig: action.payload }
      };
    
    case 'SET_SEARCH':
      return {
        ...state,
        filters: { ...state.filters, searchQuery: action.payload }
      };
    
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: {
          sortConfig: null,
          filterConfig: null,
          searchQuery: ''
        }
      };
    
    // 洞察相关
    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: { ...state.insights, data: action.payload }
      };
    
    case 'SELECT_INSIGHT':
      return {
        ...state,
        insights: { ...state.insights, selectedInsight: action.payload }
      };
    
    // 缓存相关
    case 'CACHE_QUERY':
      const newCache = new Map(state.cache.queries);
      newCache.set(action.payload.key, action.payload.data);
      return {
        ...state,
        cache: {
          ...state.cache,
          queries: newCache,
          lastQueryTime: Date.now()
        }
      };
    
    case 'CLEAR_CACHE':
      return {
        ...state,
        cache: {
          queries: new Map(),
          lastQueryTime: 0
        }
      };
    
    default:
      return state;
  }
};

// Context创建
const DataContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider组件
interface DataProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

export const DataProvider: React.FC<DataProviderProps> = ({
  children,
  initialState: customInitialState
}) => {
  const [state, dispatch] = useReducer(
    appReducer,
    { ...initialState, ...customInitialState }
  );

  return (
    <DataContext.Provider value={{ state, dispatch }}>
      {children}
    </DataContext.Provider>
  );
};

// Hook for using context
export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

// 便捷的hooks
export const useAppState = () => {
  const { state } = useDataContext();
  return state;
};

export const useAppDispatch = () => {
  const { dispatch } = useDataContext();
  return dispatch;
};

// 特定功能的hooks
export const useCurrentData = () => {
  const { state } = useDataContext();
  return state.currentData;
};

export const useMessages = () => {
  const { state } = useDataContext();
  return state.messages;
};

export const useUIState = () => {
  const { state } = useDataContext();
  return state.ui;
};

export const useChartState = () => {
  const { state } = useDataContext();
  return state.chart;
};

export const useFilters = () => {
  const { state } = useDataContext();
  return state.filters;
};

export const useInsights = () => {
  const { state } = useDataContext();
  return state.insights;
};