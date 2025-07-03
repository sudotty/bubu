/**
 * 类型定义统一导出文件
 * 提供所有类型定义的统一入口
 */

// 核心数据类型
export * from './data';
// 确保FilterConfig被正确导出
export type { FilterConfig } from './data';
// 表格相关类型定义（内联定义，避免循环依赖）
export interface ColumnDefinition {
  key: string;
  title: string;
  dataIndex: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: any, index: number) => React.ReactNode;
}

export interface TableRow {
  [key: string]: any;
}

export interface TableState {
  data: TableRow[];
  loading: boolean;
  error: string | null;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
}
// 注意：chart 和 conversation 类型文件需要创建
// export * from './chart';
// export * from './conversation';

// 现有类型定义（保持向后兼容）
export interface FileInfo {
  id: number;
  filename: string;
  file_path: string;
  file_type: string;
  upload_time: string;
  file_size: number;
  status: string;
}

export type ViewType = 'files' | 'tables' | 'history';

export interface TableClassification {
  systemTables: string[];
  userTables: string[];
  filteredSystemTables: string[];
}

export interface SystemInfo {
  upload_path: string;
  database_path: string;
  upload_size: number;
  database_size: number;
}


// export * from './chart';     // 需要创建
// export * from './conversation'; // 需要创建

// 通用工具类型
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

// 工具类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ValueOf<T> = T[keyof T];

// 常量类型
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = typeof HTTP_METHODS[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = typeof SORT_DIRECTIONS[number];

export const THEMES = ['light', 'dark', 'auto'] as const;
export type Theme = typeof THEMES[number];

export const FILE_TYPES = ['csv', 'json', 'xlsx', 'pdf'] as const;
export type FileType = typeof FILE_TYPES[number];

export const CHART_TYPES = ['bar', 'line', 'pie', 'scatter', 'area'] as const;
export type ChartType = typeof CHART_TYPES[number];

export const DATA_TYPES = ['string', 'number', 'boolean', 'date', 'object'] as const;
export type DataType = typeof DATA_TYPES[number];