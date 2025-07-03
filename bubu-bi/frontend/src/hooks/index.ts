/**
 * Hooks 统一导出文件
 * 提供所有自定义 hooks 的统一入口
 */

// 核心业务 hooks
export * from './core/useQuery';
export * from './core/useConversation';

// 数据处理 hooks
export * from './useOptimizedData';

// 现有的 hooks（保持向后兼容）
// 注意：以下 hooks 可能需要重构或已被新的核心 hooks 替代
// export * from './useConversationQuery';
// export * from './useEnhancedQueryPanel';

// 类型定义
export interface HookConfig {
  enabled?: boolean;
  debug?: boolean;
  errorBoundary?: boolean;
}

export interface AsyncHookState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface PaginationHookState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
}

export interface SortHookState {
  sortBy: string | null;
  sortDirection: 'asc' | 'desc' | null;
  setSorting: (field: string, direction?: 'asc' | 'desc') => void;
  clearSorting: () => void;
}

export interface FilterHookState<T = any> {
  filters: Record<string, T>;
  setFilter: (key: string, value: T) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

// Hook 工厂函数
export const createAsyncHook = <T>(
  asyncFn: () => Promise<T>,
  config?: HookConfig
) => {
  // 实现异步 hook 工厂
};

export const createStateHook = <T>(
  initialState: T,
  config?: HookConfig
) => {
  // 实现状态 hook 工厂
};

// 常用 hook 组合
export const useTableState = () => {
  // 组合表格相关的所有 hooks
};

export const useFormState = () => {
  // 组合表单相关的所有 hooks
};

export const useDataState = () => {
  // 组合数据处理相关的所有 hooks
};

// Hook 配置
export const HOOK_CONFIG = {
  // 默认配置
  DEFAULT: {
    enabled: true,
    debug: false,
    errorBoundary: true,
  },
  
  // 开发环境配置
  DEVELOPMENT: {
    enabled: true,
    debug: true,
    errorBoundary: true,
  },
  
  // 生产环境配置
  PRODUCTION: {
    enabled: true,
    debug: false,
    errorBoundary: true,
  },
} as const;

// Hook 工具函数
export const withHookErrorBoundary = <T extends (...args: any[]) => any>(
  hook: T,
  errorHandler?: (error: Error) => void
): T => {
  // 为 hook 添加错误边界
  return hook;
};

export const withHookDebug = <T extends (...args: any[]) => any>(
  hook: T,
  debugName?: string
): T => {
  // 为 hook 添加调试功能
  return hook;
};

export const combineHooks = (...hooks: any[]) => {
  // 组合多个 hooks
};