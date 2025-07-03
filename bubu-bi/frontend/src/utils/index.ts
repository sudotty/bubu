/**
 * 工具函数统一导出文件
 * 提供所有工具函数的统一入口
 */

// 核心工具函数
export {
  DAISYUI_THEMES,
  ThemeManager,
  responsive as coreResponsive,
  animations as coreAnimations,
  // 其他核心样式工具
} from './core/styleUtils';

// 新增工具函数
export * from './types';
export * from './api';
export * from './form';
export {
  defaultTheme,
  breakpoints,
  classNames,
  cssVars,
  responsive,
  animations,
  colorUtils,
  layoutUtils,
  styleUtils,
} from './style';

// 现有工具函数（保持向后兼容）
// 注意：以下工具函数可能已被核心工具函数替代

// 工具函数配置
export const UTILS_CONFIG = {
  // 数据处理配置
  DATA: {
    MAX_ROWS: 10000,
    MAX_COLUMNS: 100,
    CHUNK_SIZE: 1000,
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
  },
  
  // 样式配置
  STYLE: {
    BREAKPOINTS: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    ANIMATION_DURATION: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
  },
  
  // 文件处理配置
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['.xlsx', '.xls', '.csv', '.json'],
    CHUNK_SIZE: 1024 * 1024, // 1MB
  },
} as const;

// 工具函数类型定义
export interface UtilsConfig {
  debug?: boolean;
  performance?: boolean;
  errorHandling?: boolean;
}

export interface DataProcessingOptions {
  chunkSize?: number;
  maxRows?: number;
  maxColumns?: number;
  validateData?: boolean;
  optimizeMemory?: boolean;
}

export interface StyleOptions {
  theme?: 'light' | 'dark' | 'auto';
  responsive?: boolean;
  animations?: boolean;
  customBreakpoints?: Record<string, string>;
}

export interface FileProcessingOptions {
  maxSize?: number;
  allowedTypes?: string[];
  validateContent?: boolean;
  progressCallback?: (progress: number) => void;
}

// 工具函数工厂
export const createDataProcessor = (options?: DataProcessingOptions) => {
  // 创建数据处理器实例
};

export const createStyleManager = (options?: StyleOptions) => {
  // 创建样式管理器实例
};

export const createFileProcessor = (options?: FileProcessingOptions) => {
  // 创建文件处理器实例
};

// 常用工具函数组合
export const createUtilsBundle = (config?: UtilsConfig) => {
  return {
    data: createDataProcessor(),
    style: createStyleManager(),
    file: createFileProcessor(),
  };
};

// 性能监控工具
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T => {
  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name || fn.name}: ${end - start}ms`);
    }
    
    return result;
  }) as T;
};

// 错误处理工具
export const withErrorHandling = <T extends (...args: any[]) => any>(
  fn: T,
  errorHandler?: (error: Error) => void
): T => {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      if (errorHandler) {
        errorHandler(error as Error);
      } else {
        console.error(`[Error] ${fn.name}:`, error);
      }
      throw error;
    }
  }) as T;
};

// 调试工具
export const withDebugLogging = <T extends (...args: any[]) => any>(
  fn: T,
  debugName?: string
): T => {
  return ((...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(`[Debug] ${debugName || fn.name} called with:`, args);
    }
    
    const result = fn(...args);
    
    if (import.meta.env.DEV) {
      console.log(`[Debug] ${debugName || fn.name} returned:`, result);
    }
    
    return result;
  }) as T;
};