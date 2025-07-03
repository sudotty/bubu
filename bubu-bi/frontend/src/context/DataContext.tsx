import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { QueryResult } from '../types/data';

/**
 * 数据上下文状态接口
 * 管理应用程序的数据状态
 */
interface DataState {
  currentData: QueryResult | null;
  dataHistory: QueryResult[];
  loading: boolean;
  error: string | null;
}

/**
 * 数据上下文操作类型
 */
type DataAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_DATA'; payload: QueryResult | null }
  | { type: 'ADD_TO_HISTORY'; payload: QueryResult }
  | { type: 'CLEAR_DATA' };

/**
 * 数据上下文接口
 */
interface DataContextType {
  state: DataState;
  dispatch: React.Dispatch<DataAction>;
}

/**
 * 初始状态
 */
const initialState: DataState = {
  currentData: null,
  dataHistory: [],
  loading: false,
  error: null,
};

/**
 * 数据状态reducer
 * @param state 当前状态
 * @param action 操作
 * @returns 新状态
 */
const dataReducer = (state: DataState, action: DataAction): DataState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_CURRENT_DATA':
      return { ...state, currentData: action.payload, loading: false, error: null };
    case 'ADD_TO_HISTORY':
      return {
        ...state,
        dataHistory: [action.payload, ...state.dataHistory.slice(0, 9)], // 保留最近10条记录
      };
    case 'CLEAR_DATA':
      return { ...state, currentData: null, error: null };
    default:
      return state;
  }
};

// 创建上下文
const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * 数据提供者组件属性
 */
interface DataProviderProps {
  children: ReactNode;
}

/**
 * 数据提供者组件
 * 为应用程序提供数据状态管理
 */
export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  return (
    <DataContext.Provider value={{ state, dispatch }}>
      {children}
    </DataContext.Provider>
  );
};

/**
 * 使用数据上下文的Hook
 * @returns 数据上下文
 * @throws 如果在DataProvider外部使用则抛出错误
 */
export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

/**
 * 数据操作Hook
 * 提供便捷的数据操作方法
 */
export const useDataActions = () => {
  const { dispatch } = useDataContext();

  return {
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    setCurrentData: (data: QueryResult | null) => dispatch({ type: 'SET_CURRENT_DATA', payload: data }),
    addToHistory: (data: QueryResult) => dispatch({ type: 'ADD_TO_HISTORY', payload: data }),
    clearData: () => dispatch({ type: 'CLEAR_DATA' }),
  };
};