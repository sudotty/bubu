/**
 * 统一组件导出 - 组件库标准化
 * 提供一致的组件接口和导入方式
 */

// 核心组件导出
export { AIConversation } from './AIConversation';
export { default as EnhancedQueryPanel } from './EnhancedQueryPanel';
export { default as ConversationInterface } from './ConversationInterface';
export { default as FilePanel } from './FilePanel';
export { default as ErrorBoundary } from './ErrorBoundary';

// 组件类型定义
export interface ComponentConfig {
  theme?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

// 通用组件属性
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  config?: ComponentConfig;
}

// 数据组件属性
export interface DataComponentProps extends BaseComponentProps {
  data?: any[];
  loading?: boolean;
  error?: string | null;
}

// 交互组件属性
export interface InteractiveComponentProps extends BaseComponentProps {
  onClick?: () => void;
  onSubmit?: (data: any) => void;
  onChange?: (value: any) => void;
}

// 导出其他常用组件
export { default as AppSettingsModal } from './AppSettingsModal';
export { default as ConversationMessage } from './ConversationMessage';
export { default as ConversationSelector } from './ConversationSelector';
export { default as DebugInfoPanel } from './DebugInfoPanel';
export { default as DebugToggle } from './DebugToggle';

export { default as EnhancedPromptModal } from './EnhancedPromptModal';
export { default as FileCard } from './FileCard';
export { default as FileList } from './FileList';
export { InputSuggestions } from './InputSuggestions';
export { default as LoadingMessage } from './LoadingMessage';
export { NotificationProvider, useNotification, useNotificationMethods } from './NotificationSystem';

export { PromptModal } from './PromptModal';
export { default as SmartInput } from './SmartInput';
export { default as TemplatePanel } from './TemplatePanel';
export { default as ThemeSelector } from './ThemeSelector';

// 组件配置
export const COMPONENT_CONFIG = {
  // 表格配置
  table: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    maxHeight: '600px',
    stickyHeader: true,
    zebra: true
  },
  
  // 图表配置
  chart: {
    defaultType: 'bar' as const,
    responsive: true,
    maintainAspectRatio: false,
    colors: [
      '#3B82F6', // blue
      '#10B981', // emerald
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // violet
      '#06B6D4', // cyan
      '#84CC16', // lime
      '#F97316'  // orange
    ]
  },
  
  // 对话配置
  conversation: {
    maxMessages: 100,
    autoScroll: true,
    showTimestamp: true,
    enableMarkdown: true
  },
  
  // 文件上传配置
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    acceptedTypes: ['.csv', '.xlsx', '.json'],
    multiple: true,
    dragAndDrop: true
  }
};

// 组件主题
export const COMPONENT_THEMES = {
  light: {
    primary: 'hsl(var(--p))',
    secondary: 'hsl(var(--s))',
    accent: 'hsl(var(--a))',
    neutral: 'hsl(var(--n))',
    base: 'hsl(var(--b1))',
    info: 'hsl(var(--in))',
    success: 'hsl(var(--su))',
    warning: 'hsl(var(--wa))',
    error: 'hsl(var(--er))'
  },
  dark: {
    primary: 'hsl(var(--p))',
    secondary: 'hsl(var(--s))',
    accent: 'hsl(var(--a))',
    neutral: 'hsl(var(--n))',
    base: 'hsl(var(--b1))',
    info: 'hsl(var(--in))',
    success: 'hsl(var(--su))',
    warning: 'hsl(var(--wa))',
    error: 'hsl(var(--er))'
  }
};