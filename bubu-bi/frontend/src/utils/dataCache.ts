import React from 'react';
import type { TableData } from '../types/data';

// 缓存配置
interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  enablePersistence: boolean;
}

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

// 缓存键生成器
export const generateCacheKey = (query: string, params?: Record<string, any>): string => {
  const baseKey = query.toLowerCase().replace(/\s+/g, '_');
  if (params) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${baseKey}_${btoa(paramString)}`;
  }
  return baseKey;
};

// 数据大小估算器
const estimateDataSize = (data: any): number => {
  const jsonString = JSON.stringify(data);
  return new Blob([jsonString]).size;
};

/**
 * 智能数据缓存类
 * 支持LRU淘汰策略、TTL过期、持久化存储
 */
export class DataCache<T = TableData> {
  private cache = new Map<string, CacheItem<T>>();
  private config: CacheConfig;
  private currentSize = 0;
  private readonly STORAGE_KEY = 'bubu_bi_cache';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      ttl: 30 * 60 * 1000, // 30 minutes
      enablePersistence: true,
      ...config
    };

    // 从localStorage恢复缓存
    if (this.config.enablePersistence) {
      this.loadFromStorage();
    }

    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 设置缓存
   */
  set(key: string, data: T): void {
    const size = estimateDataSize(data);
    const now = Date.now();

    // 检查是否需要清理空间
    if (this.currentSize + size > this.config.maxSize) {
      this.evictLRU(size);
    }

    // 如果key已存在，先移除旧数据
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key)!;
      this.currentSize -= oldItem.size;
    }

    // 添加新数据
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size
    };

    this.cache.set(key, item);
    this.currentSize += size;

    // 持久化到localStorage
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    
    // 检查是否过期
    if (now - item.timestamp > this.config.ttl) {
      this.delete(key);
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccessed = now;

    return item.data;
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.size;
      this.cache.delete(key);
      
      if (this.config.enablePersistence) {
        this.saveToStorage();
      }
      
      return true;
    }
    return false;
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    const now = Date.now();
    if (now - item.timestamp > this.config.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    
    if (this.config.enablePersistence) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    const items = Array.from(this.cache.values());
    
    return {
      totalItems: this.cache.size,
      totalSize: this.currentSize,
      maxSize: this.config.maxSize,
      utilizationRate: (this.currentSize / this.config.maxSize) * 100,
      averageItemSize: items.length > 0 ? this.currentSize / items.length : 0,
      expiredItems: items.filter(item => now - item.timestamp > this.config.ttl).length,
      mostAccessed: items.sort((a, b) => b.accessCount - a.accessCount).slice(0, 5),
      oldestItem: items.reduce((oldest, item) => 
        item.timestamp < oldest.timestamp ? item : oldest, items[0]
      )
    };
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(requiredSpace: number): void {
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    for (const item of items) {
      if (freedSpace >= requiredSpace) {
        break;
      }
      
      this.cache.delete(item.key);
      this.currentSize -= item.size;
      freedSpace += item.size;
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.config.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  /**
   * 保存到localStorage
   */
  private saveToStorage(): void {
    try {
      const cacheData = {
        cache: Array.from(this.cache.entries()),
        currentSize: this.currentSize,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  /**
   * 从localStorage加载
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const cacheData = JSON.parse(stored);
      const now = Date.now();

      // 检查存储的缓存是否过期（超过1天）
      if (now - cacheData.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.STORAGE_KEY);
        return;
      }

      // 恢复缓存数据
      this.cache = new Map(cacheData.cache);
      this.currentSize = cacheData.currentSize;

      // 清理过期项
      this.cleanup();
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}

// 全局缓存实例
export const globalDataCache = new DataCache<TableData>({
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 60 * 60 * 1000, // 1 hour
  enablePersistence: true
});

/**
 * 懒加载数据Hook
 */
export const useLazyData = <T>(loader: () => Promise<T>, deps: any[] = []) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const loadedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (loadedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await loader();
      setData(result);
      loadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, deps);

  const reload = React.useCallback(async () => {
    loadedRef.current = false;
    await load();
  }, [load]);

  return {
    data,
    loading,
    error,
    load,
    reload,
    loaded: loadedRef.current
  };
};

/**
 * 缓存装饰器函数
 */
export const withCache = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  cache: DataCache<R> = globalDataCache as any
) => {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);
    
    // 尝试从缓存获取
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }

    // 执行函数并缓存结果
    const result = await fn(...args);
    cache.set(key, result);
    
    return result;
  };
};