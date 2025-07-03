/**
 * 性能优化组件统一导出
 * 提供懒加载、性能监控等优化功能
 */

// 懒加载组件
export { default as LazyLoad, LazyImage, LazyComponent } from './LazyLoad';
export type { LazyLoadProps, LazyImageProps, LazyComponentProps } from './LazyLoad';

// 性能监控组件
export { default as PerformanceMonitor, usePerformanceMonitor } from './PerformanceMonitor';
export type { PerformanceMonitorProps, PerformanceMetrics } from './PerformanceMonitor';

/**
 * 性能优化配置
 */
export const PERFORMANCE_CONFIG = {
  // 懒加载配置
  lazyLoad: {
    defaultRootMargin: '50px',
    defaultThreshold: 0.1,
    defaultDelay: 0
  },
  
  // 性能监控配置
  monitor: {
    defaultInterval: 1000,
    defaultThresholds: {
      renderTime: 16, // 60fps = 16.67ms per frame
      memoryUsage: 100, // 100MB
      fps: 30
    },
    maxMetricsHistory: 100
  },
  
  // 虚拟化配置
  virtualization: {
    itemHeight: 48,
    overscan: 5,
    threshold: 1000 // 超过1000项启用虚拟化
  }
} as const;

/**
 * 性能优化工具函数
 */
export const performanceUtils = {
  /**
   * 防抖函数
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func.apply(null, args), wait);
    };
  },
  
  /**
   * 节流函数
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
  
  /**
   * 请求动画帧节流
   */
  rafThrottle: <T extends (...args: any[]) => any>(
    func: T
  ): ((...args: Parameters<T>) => void) => {
    let rafId: number;
    return (...args: Parameters<T>) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => func.apply(null, args));
    };
  },
  
  /**
   * 检测是否支持 Intersection Observer
   */
  supportsIntersectionObserver: (): boolean => {
    return (
      typeof window !== 'undefined' &&
      'IntersectionObserver' in window &&
      'IntersectionObserverEntry' in window &&
      'intersectionRatio' in window.IntersectionObserverEntry.prototype
    );
  },
  
  /**
   * 检测是否支持 Web Workers
   */
  supportsWebWorkers: (): boolean => {
    return typeof Worker !== 'undefined';
  },
  
  /**
   * 检测是否支持 Service Workers
   */
  supportsServiceWorkers: (): boolean => {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    );
  },
  
  /**
   * 获取设备性能等级
   */
  getDevicePerformanceLevel: (): 'low' | 'medium' | 'high' => {
    if (typeof navigator === 'undefined') return 'medium';
    
    // 检测硬件并发数
    const cores = navigator.hardwareConcurrency || 4;
    
    // 检测内存大小（如果可用）
    const memory = (navigator as any).deviceMemory;
    
    if (cores >= 8 && (!memory || memory >= 8)) {
      return 'high';
    } else if (cores >= 4 && (!memory || memory >= 4)) {
      return 'medium';
    } else {
      return 'low';
    }
  },
  
  /**
   * 预加载资源
   */
  preloadResource: (url: string, type: 'script' | 'style' | 'image' | 'font' = 'script'): Promise<void> => {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      
      switch (type) {
        case 'script':
          link.as = 'script';
          break;
        case 'style':
          link.as = 'style';
          break;
        case 'image':
          link.as = 'image';
          break;
        case 'font':
          link.as = 'font';
          link.crossOrigin = 'anonymous';
          break;
      }
      
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to preload ${url}`));
      
      document.head.appendChild(link);
    });
  },
  
  /**
   * 测量函数执行时间
   */
  measurePerformance: async <T>(
    name: string,
    func: () => T | Promise<T>
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await func();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }
};

/**
 * 性能优化 Hook
 */
export const usePerformanceOptimization = () => {
  const deviceLevel = performanceUtils.getDevicePerformanceLevel();
  
  const getOptimalConfig = () => {
    switch (deviceLevel) {
      case 'low':
        return {
          enableVirtualization: true,
          lazyLoadThreshold: 0.5,
          debounceDelay: 300,
          maxConcurrentRequests: 2
        };
      case 'medium':
        return {
          enableVirtualization: false,
          lazyLoadThreshold: 0.3,
          debounceDelay: 200,
          maxConcurrentRequests: 4
        };
      case 'high':
        return {
          enableVirtualization: false,
          lazyLoadThreshold: 0.1,
          debounceDelay: 100,
          maxConcurrentRequests: 8
        };
      default:
        return {
          enableVirtualization: false,
          lazyLoadThreshold: 0.3,
          debounceDelay: 200,
          maxConcurrentRequests: 4
        };
    }
  };
  
  return {
    deviceLevel,
    config: getOptimalConfig(),
    utils: performanceUtils
  };
};