import { useState, useCallback } from 'react';
import { useDataStore, useQueryStore, useUIStore } from '../../store';
import {
  ExecuteNaturalLanguageQuery,
  ExecuteSQL,
  ProcessNaturalLanguage,
  ProcessNaturalLanguageWithFiles,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import type { ConversationMessage } from '../../types/data';

type BackendQueryResult = main.QueryResult;
type LLMProcessResult = main.LLMProcessResult;
type QueryMode = 'natural' | 'sql';

export interface QueryOptions {
  mode?: QueryMode;
  selectedFiles?: string[];
  enableCache?: boolean;
  timeout?: number;
}

export interface QueryResult {
  loading: boolean;
  error: string | null;
  execute: (query: string, options?: QueryOptions) => Promise<void>;
  reset: () => void;
}

/**
 * 统一查询Hook - 简化的查询功能
 * 支持自然语言和SQL查询，统一的错误处理和状态管理
 */
export const useQuery = (): QueryResult => {
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { 
    loading: storeLoading, 
    error: storeError, 
    clearData 
  } = useDataStore();
  
  const { 
    queryMode, 
    addToQueryHistory, 
    setCurrentQuery 
  } = useQueryStore();
  
  const { addNotification } = useUIStore();
  
  const loading = localLoading || storeLoading;
  const error = localError || storeError;
  
  const executeQuery = useCallback(async (query: string, options: QueryOptions = {}) => {
    if (!query.trim()) {
      setLocalError('查询不能为空');
      return;
    }
    
    setLocalLoading(true);
    setLocalError(null);
    setCurrentQuery(query);
    
    try {
      const mode = options.mode || queryMode;
      
      if (mode === 'sql') {
        console.log('Executing SQL query:', query);
        const result = await ExecuteSQL(query);
        console.log('SQL query result:', result);
      } else {
        console.log('Executing natural language query:', query);
        let result: LLMProcessResult;
        
        if (options.selectedFiles && options.selectedFiles.length > 0) {
          result = await ProcessNaturalLanguageWithFiles(query, options.selectedFiles);
        } else {
          result = await ProcessNaturalLanguage(query);
        }
        
        console.log('Natural language query result:', result);
      }
      
      addToQueryHistory(query);
      addNotification({
        type: 'success',
        title: '查询成功',
        message: '查询执行成功',
        duration: 3000
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查询执行失败';
      setLocalError(errorMessage);
      addNotification({
        type: 'error',
        title: '查询失败',
        message: errorMessage,
        duration: 5000
      });
      console.error('Query execution error:', err);
    } finally {
      setLocalLoading(false);
    }
  }, [queryMode, addToQueryHistory, setCurrentQuery, addNotification]);
  
  const reset = useCallback(() => {
    setLocalLoading(false);
    setLocalError(null);
    clearData();
  }, [clearData]);
  
  return {
    loading,
    error,
    execute: executeQuery,
    reset
  };
};