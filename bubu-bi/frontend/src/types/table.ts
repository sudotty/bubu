// React 19 + TypeScript 5.8.3 严格类型定义

// 基础单元格值类型 - 更严格的类型约束
export type CellValue = string | number | boolean | null | undefined;

// 排序方向类型
export type SortDirection = 'asc' | 'desc';

// 列定义接口 - 支持更丰富的列配置
export interface ColumnDefinition<T = CellValue> {
  key: string;
  title: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  formatter?: (value: T) => string;
  validator?: (value: unknown) => value is T;
}

// 排序配置接口
export interface SortConfig {
  columnKey: string;
  direction: SortDirection;
}

// 表格行数据类型 - 泛型支持
export type TableRow<T extends Record<string, CellValue> = Record<string, CellValue>> = T;

// 表格数据接口 - 泛型化和严格类型
export interface TableData<T extends TableRow = TableRow> {
  columns: ColumnDefinition[];
  rows: T[];
  totalCount?: number;
  metadata?: {
    source: string;
    timestamp: Date;
    queryId: string;
    version: string;
  };
}

// 虚拟化配置接口
export interface VirtualizationConfig {
  rowHeight: number;
  overscanCount?: number;
  estimatedRowHeight?: number;
  dynamicHeight?: boolean;
}

// 表格事件处理器类型
export interface TableEventHandlers<T extends TableRow = TableRow> {
  onCellClick?: (params: {
    rowIndex: number;
    columnKey: string;
    value: CellValue;
    row: T;
  }) => void;
  onRowClick?: (params: {
    rowIndex: number;
    row: T;
  }) => void;
  onSort?: (sortConfig: SortConfig | null) => void;
  onColumnResize?: (columnKey: string, width: number) => void;
}

// 表格状态接口
export interface TableState {
  isFullscreen: boolean;
  sortConfig: SortConfig | null;
  selectedRows: Set<number>;
  loading: boolean;
  error: Error | null;
}

// 国际化文本接口
export interface TableI18nTexts {
  totalRows: string;
  clearSort: string;
  fullscreen: string;
  exitFullscreen: string;
  noData: string;
  loading: string;
  error: string;
  sortAscending: string;
  sortDescending: string;
}

// 表格主要属性接口 - React 19 优化
export interface VirtualizedTableProps<T extends TableRow = TableRow> {
  data: TableData<T>;
  height?: number;
  virtualization?: VirtualizationConfig;
  eventHandlers?: TableEventHandlers<T>;
  features?: {
    sortable?: boolean;
    resizable?: boolean;
    fullscreen?: boolean;
    selection?: boolean;
  };
  styling?: {
    className?: string;
    rowClassName?: (row: T, index: number) => string;
    cellClassName?: (value: CellValue, columnKey: string) => string;
  };
  i18n?: Partial<TableI18nTexts>;
  performance?: {
    enableMemoization?: boolean;
    debounceMs?: number;
    cacheSize?: number;
  };
}

// 性能监控接口
export interface PerformanceMetrics {
  renderTime: number;
  scrollPerformance: number;
  memoryUsage: number;
  cacheHitRate: number;
}

// 错误类型
export class TableError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TableError';
  }
}

// 类型守卫函数
export const isValidCellValue = (value: unknown): value is CellValue => {
  return value === null || value === undefined || 
         typeof value === 'string' || 
         typeof value === 'number' || 
         typeof value === 'boolean';
};

export const isValidTableData = <T extends TableRow>(
  data: unknown
): data is TableData<T> => {
  if (!data || typeof data !== 'object') return false;
  
  const tableData = data as TableData<T>;
  return (
    Array.isArray(tableData.columns) &&
    Array.isArray(tableData.rows) &&
    tableData.columns.every(col => 
      typeof col === 'object' && 
      typeof col.key === 'string' && 
      typeof col.title === 'string'
    )
  );
};