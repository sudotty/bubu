// 数据类型定义文件

// 基础数据类型
export type CellValue = string | number | boolean | null;

// 表格数据接口
export interface TableData {
  columns: string[];
  rows: CellValue[][];
  total?: number;
  metadata?: {
    source: string;
    timestamp: Date;
    queryId: string;
    fileSize?: number;
    processingTime?: number;
  };
}

// 图表配置接口
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  title?: string;
  xAxis?: string;
  yAxis?: string[];
  colors?: string[];
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: {
      legend?: {
        display?: boolean;
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
      tooltip?: {
        enabled?: boolean;
      };
    };
  };
}

// 数据洞察接口
export interface DataInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'correlation' | 'summary' | 'recommendation';
  title: string;
  description: string;
  confidence: number; // 0-1
  severity: 'low' | 'medium' | 'high';
  data?: {
    value?: number;
    change?: number;
    comparison?: string;
    details?: Record<string, any>;
  };
  timestamp: Date;
}

// 分析洞察接口
export interface AnalysisInsight {
  category: string;
  insights: DataInsight[];
  timestamp: number;
  dataSize: number;
}

// 调试信息接口
export interface DebugInfo {
  queryId: string;
  executionTime: number;
  dataSource: string;
  rowsProcessed: number;
  cacheHit: boolean;
  errors?: string[];
  warnings?: string[];
  performance?: {
    parseTime: number;
    renderTime: number;
    memoryUsage: number;
  };
}

// 对话消息接口
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  data?: TableData;
  chart?: ChartConfig;
  insights?: DataInsight[];
  suggestions?: string[];
  debugInfo?: import('../types/debug').DebugInfo;
}

// 查询状态接口
export interface QueryState {
  isLoading: boolean;
  error: Error | null;
  progress?: {
    current: number;
    total: number;
    stage: string;
  };
}

// 文件上传接口
export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: TableData;
}

// 导出选项接口
export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  includeHeaders: boolean;
  selectedRows?: number[];
  selectedColumns?: string[];
  filename?: string;
}

// API 响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    processingTime: number;
  };
}

// 分页接口
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 排序接口
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

// 过滤接口
export interface FilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
  value: CellValue;
}

// 搜索配置接口
export interface SearchConfig {
  term: string;
  columns?: string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

// 虚拟化表格配置接口
export interface VirtualizationConfig {
  rowHeight: number;
  headerHeight: number;
  overscan: number;
  estimatedRowHeight?: number;
}

// 主题配置接口
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'standard' | 'comfortable';
}

// 用户偏好设置接口
export interface UserPreferences {
  theme: ThemeConfig;
  defaultChartType: ChartConfig['type'];
  autoSave: boolean;
  showDebugInfo: boolean;
  maxRowsPerPage: number;
  enableVirtualization: boolean;
}