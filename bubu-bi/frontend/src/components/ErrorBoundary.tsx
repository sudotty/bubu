import React, { Component, ErrorInfo, ReactNode } from 'react';
import { UI_CONSTANTS } from '../constants/ui';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

// 错误边界组件
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 在开发环境下显示详细错误信息
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    this.setState({
      error,
      errorInfo
    });

    // 调用外部错误处理函数
    this.props.onError?.(error, errorInfo);

    // 发送错误报告到监控系统（如果需要）
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // 如果props发生变化且设置了重置标志，则重置错误状态
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // 这里可以集成错误监控服务，如 Sentry
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // 发送到监控服务
    console.warn('Error report:', errorReport);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // 如果提供了自定义fallback，使用它
      if (fallback && errorInfo) {
        return fallback(error, errorInfo);
      }

      // 默认错误UI
      return <DefaultErrorFallback error={error} onRetry={this.handleRetry} onReload={this.handleReload} />;
    }

    return children;
  }
}

// 默认错误回退组件
interface DefaultErrorFallbackProps {
  error: Error;
  onRetry: () => void;
  onReload: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onRetry, onReload }) => {
  const isDevelopment = import.meta.env.DEV;

  return (
    <div className="min-h-[200px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-error/10 border border-error/20 rounded-lg p-6 text-center">
        <div className="text-error text-4xl mb-4">
          {UI_CONSTANTS.ICONS.ERROR}
        </div>
        
        <h3 className="text-lg font-semibold text-error mb-2">
          出现了一个错误
        </h3>
        
        <p className="text-base-content/70 mb-4">
          {error.message || '未知错误，请稍后重试'}
        </p>

        {isDevelopment && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-base-content/60 hover:text-base-content">
              错误详情 (开发模式)
            </summary>
            <pre className="mt-2 p-2 bg-base-200 rounded text-xs overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={onRetry}
            className="btn btn-primary btn-sm"
          >
            重试
          </button>
          <button
            onClick={onReload}
            className="btn btn-outline btn-sm"
          >
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
};

// 数据可视化专用错误边界
export const DataVisualizationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('数据可视化错误:', error, errorInfo);
  };

  const fallback = (error: Error) => (
    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
      <div className="flex items-center gap-2 text-warning mb-2">
        <span>{UI_CONSTANTS.ICONS.ERROR}</span>
        <span className="font-medium">数据可视化失败</span>
      </div>
      <p className="text-sm text-base-content/70">
        {error.message || '无法渲染数据可视化组件'}
      </p>
    </div>
  );

  return (
    <ErrorBoundary onError={handleError} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

// 表格专用错误边界
export const TableErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  const fallback = (error: Error) => (
    <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-center">
      <div className="text-error text-2xl mb-2">
        {UI_CONSTANTS.ICONS.ERROR}
      </div>
      <p className="text-sm text-base-content/70">
        表格渲染失败: {error.message}
      </p>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;