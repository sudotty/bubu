/**
 * UI组件库统一导出
 * 
 * 这个文件提供了所有标准化UI组件的统一入口，
 * 便于在项目中导入和使用组件。
 */

// 基础组件
// Button和Input组件已移除，项目使用SmartInput替代

// 工具函数
export { cn, type ClassValue } from '../../utils/ui/classNames';

// 组件类型定义
export interface ComponentTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

/**
 * 默认主题配置
 */
export const defaultTheme: ComponentTheme = {
  colors: {
    primary: 'blue',
    secondary: 'gray',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
};

/**
 * 组件尺寸映射
 */
export const sizeMap = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
  xl: 'extra-large',
} as const;

/**
 * 组件状态映射
 */
export const stateMap = {
  default: 'normal',
  error: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
} as const;

/**
 * 响应式断点
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * 组件库版本信息
 */
export const version = '1.0.0';

/**
 * 组件库配置
 */
export interface UIConfig {
  theme: ComponentTheme;
  prefix?: string;
  rtl?: boolean;
}

/**
 * 默认配置
 */
export const defaultConfig: UIConfig = {
  theme: defaultTheme,
  prefix: '',
  rtl: false,
};