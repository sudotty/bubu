import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '../../utils/ui/classNames';

/**
 * 性能监控组件
 * 监控组件渲染性能、内存使用、网络请求等
 */

export interface PerformanceMetrics {
  /** 组件渲染时间 */
  renderTime: number;
  /** 内存使用量 */
  memoryUsage?: {
    used: number;
    total: number;
  };
  /** FPS */
  fps: number;
  /** 网络请求数量 */
  networkRequests: number;
  /** 错误数量 */
  errorCount: number;
  /** 时间戳 */
  timestamp: number;
}

export interface PerformanceMonitorProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 是否启用监控 */
  enabled?: boolean;
  /** 监控间隔（毫秒） */
  interval?: number;
  /** 性能数据回调 */
  onMetrics?: (metrics: PerformanceMetrics) => void;
  /** 性能警告阈值 */
  thresholds?: {
    renderTime?: number; // 渲染时间阈值（毫秒）
    memoryUsage?: number; // 内存使用阈值（MB）
    fps?: number; // FPS 阈值
  };
  /** 是否显示性能面板 */
  showPanel?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 性能数据收集Hook
 */
const usePerformanceMetrics = (enabled: boolean, interval: number) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    fps: 60,
    networkRequests: 0,
    errorCount: 0,
    timestamp: Date.now()
  });
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderStartRef = useRef(0);
  const networkCountRef = useRef(0);
  const errorCountRef = useRef(0);
  
  // FPS 计算
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
      return fps;
    }
    
    frameCountRef.current++;
    return 60; // 返回默认值而不是依赖metrics.fps，避免无限循环
  }, []); // 移除metrics.fps依赖，避免无限循环
  
  // 内存使用量获取
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024)
      };
    }
    return undefined;
  }, []);
  
  // 网络请求监控
  useEffect(() => {
    if (!enabled) return;
    
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    // 监控 fetch 请求
    window.fetch = async (...args) => {
      networkCountRef.current++;
      return originalFetch.apply(window, args);
    };
    
    // 监控 XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
      networkCountRef.current++;
      return originalXHROpen.call(this, method, url, async, username, password);
    };
    
    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
    };
  }, [enabled]);
  
  // 错误监控
  useEffect(() => {
    if (!enabled) return;
    
    const handleError = () => {
      errorCountRef.current++;
    };
    
    const handleUnhandledRejection = () => {
      errorCountRef.current++;
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [enabled]);
  
  // 定期更新性能指标
  useEffect(() => {
    if (!enabled) return;
    
    let animationId: number;
    
    const updateMetrics = () => {
      const fps = calculateFPS();
      const memoryUsage = getMemoryUsage();
      const renderTime = performance.now() - renderStartRef.current;
      
      setMetrics({
        renderTime,
        memoryUsage,
        fps,
        networkRequests: networkCountRef.current,
        errorCount: errorCountRef.current,
        timestamp: Date.now()
      });
      
      // 使用setTimeout代替requestAnimationFrame，避免无限循环
      animationId = window.setTimeout(updateMetrics, interval);
    };
    
    const intervalId = setInterval(() => {
      renderStartRef.current = performance.now();
    }, interval);
    
    // 初始调用
    updateMetrics();
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(animationId);
    };
  }, [enabled, interval]); // 移除函数依赖，因为它们已经用useCallback稳定化
  
  return metrics;
};

/**
 * 性能面板组件
 */
const PerformancePanel: React.FC<{
  metrics: PerformanceMetrics;
  thresholds?: PerformanceMonitorProps['thresholds'];
}> = ({ metrics, thresholds }) => {
  const isRenderTimeHigh = thresholds?.renderTime && metrics.renderTime > thresholds.renderTime;
  const isMemoryHigh = thresholds?.memoryUsage && metrics.memoryUsage && 
    metrics.memoryUsage.used > thresholds.memoryUsage;
  const isFPSLow = thresholds?.fps && metrics.fps < thresholds.fps;
  
  const hasWarning = isRenderTimeHigh || isMemoryHigh || isFPSLow;
  
  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 p-4 bg-base-100 border border-base-300 rounded-lg shadow-lg',
      'min-w-[280px] text-sm',
      hasWarning && 'border-warning'
    )}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base-content">性能监控</h3>
        {hasWarning && (
          <div className="badge badge-warning badge-sm">警告</div>
        )}
      </div>
      
      <div className="space-y-2">
        {/* 渲染时间 */}
        <div className="flex justify-between items-center">
          <span className="text-base-content/70">渲染时间:</span>
          <span className={cn(
            'font-mono',
            isRenderTimeHigh ? 'text-warning' : 'text-base-content'
          )}>
            {metrics.renderTime.toFixed(2)}ms
          </span>
        </div>
        
        {/* FPS */}
        <div className="flex justify-between items-center">
          <span className="text-base-content/70">FPS:</span>
          <span className={cn(
            'font-mono',
            isFPSLow ? 'text-warning' : 'text-base-content'
          )}>
            {metrics.fps}
          </span>
        </div>
        
        {/* 内存使用 */}
        {metrics.memoryUsage && (
          <div className="flex justify-between items-center">
            <span className="text-base-content/70">内存:</span>
            <span className={cn(
              'font-mono',
              isMemoryHigh ? 'text-warning' : 'text-base-content'
            )}>
              {metrics.memoryUsage.used}MB / {metrics.memoryUsage.total}MB
            </span>
          </div>
        )}
        
        {/* 网络请求 */}
        <div className="flex justify-between items-center">
          <span className="text-base-content/70">网络请求:</span>
          <span className="font-mono text-base-content">
            {metrics.networkRequests}
          </span>
        </div>
        
        {/* 错误数量 */}
        {metrics.errorCount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-base-content/70">错误:</span>
            <span className="font-mono text-error">
              {metrics.errorCount}
            </span>
          </div>
        )}
      </div>
      
      {/* 性能建议 */}
      {hasWarning && (
        <div className="mt-3 pt-3 border-t border-base-300">
          <div className="text-xs text-base-content/60">
            <div className="font-medium mb-1">性能建议:</div>
            <ul className="space-y-1">
              {isRenderTimeHigh && (
                <li>• 渲染时间过长，考虑优化组件</li>
              )}
              {isFPSLow && (
                <li>• FPS 过低，检查动画和重绘</li>
              )}
              {isMemoryHigh && (
                <li>• 内存使用过高，检查内存泄漏</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  children,
  enabled = typeof window !== 'undefined' && window.location.hostname === 'localhost',
  interval = 1000,
  onMetrics,
  thresholds = {
    renderTime: 16, // 60fps = 16.67ms per frame
    memoryUsage: 100, // 100MB
    fps: 30
  },
  showPanel = false,
  className
}) => {
  const metrics = usePerformanceMetrics(enabled, interval);
  const renderStartRef = useRef(0);
  
  // 记录渲染开始时间
  useEffect(() => {
    renderStartRef.current = performance.now();
  });
  
  // 触发性能数据回调 - 使用useCallback稳定onMetrics依赖
  const stableOnMetrics = useCallback(onMetrics || (() => {}), [onMetrics]);
  
  useEffect(() => {
    if (enabled && onMetrics) {
      stableOnMetrics(metrics);
    }
  }, [enabled, metrics, stableOnMetrics]); // 移除onMetrics依赖，因为已经通过stableOnMetrics稳定化
  
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <div className={className}>
      {children}
      {showPanel && (
        <PerformancePanel metrics={metrics} thresholds={thresholds} />
      )}
    </div>
  );
};

/**
 * 性能监控Hook
 */
export const usePerformanceMonitor = (enabled = true) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  
  const addMetrics = useCallback((newMetrics: PerformanceMetrics) => {
    setCurrentMetrics(newMetrics);
    setMetrics(prev => {
      const updated = [...prev, newMetrics];
      // 保留最近100条记录
      return updated.slice(-100);
    });
  }, []);
  
  const clearMetrics = useCallback(() => {
    setMetrics([]);
    setCurrentMetrics(null);
  }, []);
  
  const getAverageMetrics = useCallback(() => {
    if (metrics.length === 0) return null;
    
    const sum = metrics.reduce((acc, metric) => ({
      renderTime: acc.renderTime + metric.renderTime,
      fps: acc.fps + metric.fps,
      networkRequests: acc.networkRequests + metric.networkRequests,
      errorCount: acc.errorCount + metric.errorCount
    }), {
      renderTime: 0,
      fps: 0,
      networkRequests: 0,
      errorCount: 0
    });
    
    const count = metrics.length;
    return {
      renderTime: sum.renderTime / count,
      fps: sum.fps / count,
      networkRequests: sum.networkRequests / count,
      errorCount: sum.errorCount / count
    };
  }, [metrics]);
  
  return {
    metrics,
    currentMetrics,
    addMetrics,
    clearMetrics,
    getAverageMetrics,
    enabled
  };
};

export default PerformanceMonitor;