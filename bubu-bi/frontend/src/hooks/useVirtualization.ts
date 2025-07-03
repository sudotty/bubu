// React 19 虚拟滚动优化 Hook
import { useCallback, useRef, useMemo, useLayoutEffect, useState } from 'react';
import type { VirtualizationConfig, PerformanceMetrics } from '../types/table';

interface VirtualizationState {
  startIndex: number;
  endIndex: number;
  visibleItems: number;
  scrollTop: number;
  containerHeight: number;
}

interface UseVirtualizationProps {
  itemCount: number;
  config: VirtualizationConfig;
  containerHeight: number;
}

// 性能监控工具
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    scrollPerformance: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
  };

  private renderStart = 0;
  private scrollStart = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  startRender() {
    this.renderStart = performance.now();
  }

  endRender() {
    this.metrics.renderTime = performance.now() - this.renderStart;
  }

  startScroll() {
    this.scrollStart = performance.now();
  }

  endScroll() {
    this.metrics.scrollPerformance = performance.now() - this.scrollStart;
  }

  recordCacheHit() {
    this.cacheHits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss() {
    this.cacheMisses++;
    this.updateCacheHitRate();
  }

  private updateCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
  }

  getMetrics(): PerformanceMetrics {
    // 获取内存使用情况（如果支持）
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    }
    return { ...this.metrics };
  }
}

// 虚拟滚动 Hook
export const useVirtualization = ({
  itemCount,
  config,
  containerHeight,
}: UseVirtualizationProps) => {
  const [state, setState] = useState<VirtualizationState>({
    startIndex: 0,
    endIndex: 0,
    visibleItems: 0,
    scrollTop: 0,
    containerHeight,
  });

  const performanceMonitor = useRef(new PerformanceMonitor());
  const scrollTimeoutRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);
  const heightCacheRef = useRef(new Map<number, number>());

  // 计算可见项目范围
  const calculateVisibleRange = useCallback((scrollTop: number, containerHeight: number) => {
    performanceMonitor.current.startRender();

    const { rowHeight, overscanCount = 5 } = config;
    const visibleItems = Math.ceil(containerHeight / rowHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanCount);
    const endIndex = Math.min(itemCount - 1, startIndex + visibleItems + overscanCount * 2);

    performanceMonitor.current.endRender();

    return {
      startIndex,
      endIndex,
      visibleItems,
      scrollTop,
      containerHeight,
    };
  }, [itemCount, config]);

  // 动态行高支持
  const getItemHeight = useCallback((index: number): number => {
    if (!config.dynamicHeight) {
      return config.rowHeight;
    }

    const cached = heightCacheRef.current.get(index);
    if (cached !== undefined) {
      performanceMonitor.current.recordCacheHit();
      return cached;
    }

    performanceMonitor.current.recordCacheMiss();
    return config.estimatedRowHeight || config.rowHeight;
  }, [config]);

  // 设置动态行高
  const setItemHeight = useCallback((index: number, height: number) => {
    if (config.dynamicHeight) {
      heightCacheRef.current.set(index, height);
    }
  }, [config.dynamicHeight]);

  // 计算总高度
  const totalHeight = useMemo(() => {
    if (!config.dynamicHeight) {
      return itemCount * config.rowHeight;
    }

    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [itemCount, config.dynamicHeight, config.rowHeight, getItemHeight]);

  // 滚动处理器 - 使用 React 19 的并发特性
  const handleScroll = useCallback((scrollTop: number) => {
    performanceMonitor.current.startScroll();
    
    // 防抖处理
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    isScrollingRef.current = true;
    
    // 使用 requestAnimationFrame 优化滚动性能
    requestAnimationFrame(() => {
      const newState = calculateVisibleRange(scrollTop, containerHeight);
      setState(newState);
      performanceMonitor.current.endScroll();
    });

    // 滚动结束检测
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150) as unknown as number;
  }, [calculateVisibleRange, containerHeight]);

  // 初始化和容器高度变化处理
  useLayoutEffect(() => {
    const newState = calculateVisibleRange(state.scrollTop, containerHeight);
    setState(newState);
  }, [containerHeight, calculateVisibleRange]);

  // 清理函数
  useLayoutEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      heightCacheRef.current.clear();
    };
  }, []);

  // 获取性能指标
  const getPerformanceMetrics = useCallback(() => {
    return performanceMonitor.current.getMetrics();
  }, []);

  // 滚动到指定项目
  const scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    let scrollTop = 0;
    
    if (config.dynamicHeight) {
      for (let i = 0; i < index; i++) {
        scrollTop += getItemHeight(i);
      }
    } else {
      scrollTop = index * config.rowHeight;
    }

    if (align === 'center') {
      scrollTop -= containerHeight / 2 - config.rowHeight / 2;
    } else if (align === 'end') {
      scrollTop -= containerHeight - config.rowHeight;
    }

    scrollTop = Math.max(0, Math.min(scrollTop, totalHeight - containerHeight));
    handleScroll(scrollTop);
    
    return scrollTop;
  }, [config, containerHeight, totalHeight, getItemHeight, handleScroll]);

  return {
    // 状态
    ...state,
    isScrolling: isScrollingRef.current,
    totalHeight,
    
    // 方法
    handleScroll,
    getItemHeight,
    setItemHeight,
    scrollToItem,
    getPerformanceMetrics,
    
    // 计算属性
    visibleRange: { start: state.startIndex, end: state.endIndex },
    itemsToRender: state.endIndex - state.startIndex + 1,
  };
};

export type { VirtualizationState, PerformanceMetrics };