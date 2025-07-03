import { useMemo } from 'react';
import type { QueryResult, CellValue } from '../types/data';

/**
 * 数据优化配置接口
 */
interface OptimizationConfig {
  enableVirtualization?: boolean;
  maxRowsToRender?: number;
  enableMemoization?: boolean;
}

/**
 * 优化后的数据结果接口
 */
interface OptimizedDataResult {
  data: QueryResult | null;
  displayData: CellValue[][];
  totalRows: number;
  isVirtualized: boolean;
  performance: {
    processingTime: number;
    memoryUsage: number;
  };
}

/**
 * 数据优化Hook
 * 提供数据虚拟化、分页和性能优化功能
 * 
 * @param data 原始查询结果数据
 * @param config 优化配置选项
 * @returns 优化后的数据和性能信息
 */
export const useOptimizedData = (
  data: QueryResult | null,
  config: OptimizationConfig = {}
): OptimizedDataResult => {
  const {
    enableVirtualization = true,
    maxRowsToRender = 1000,
    enableMemoization = true,
  } = config;

  // 使用useMemo优化数据处理性能
  const optimizedResult = useMemo(() => {
    const startTime = performance.now();
    
    if (!data) {
      return {
        data: null,
        displayData: [],
        totalRows: 0,
        isVirtualized: false,
        performance: {
          processingTime: 0,
          memoryUsage: 0,
        },
      };
    }

    const { rows } = data;
    const totalRows = rows.length;
    let displayData = rows;
    let isVirtualized = false;

    // 如果启用虚拟化且数据量超过阈值，则只渲染部分数据
    if (enableVirtualization && totalRows > maxRowsToRender) {
      displayData = rows.slice(0, maxRowsToRender);
      isVirtualized = true;
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // 估算内存使用量（简化计算）
    const memoryUsage = JSON.stringify(displayData).length * 2; // 粗略估算

    return {
      data,
      displayData,
      totalRows,
      isVirtualized,
      performance: {
        processingTime,
        memoryUsage,
      },
    };
  }, [data, enableVirtualization, maxRowsToRender, enableMemoization]);

  return optimizedResult;
};

/**
 * 数据分页Hook
 * 提供分页功能的数据处理
 * 
 * @param data 原始数据
 * @param page 当前页码（从1开始）
 * @param pageSize 每页大小
 * @returns 分页后的数据和分页信息
 */
export const usePaginatedData = (
  data: QueryResult | null,
  page: number = 1,
  pageSize: number = 50
) => {
  return useMemo(() => {
    if (!data) {
      return {
        paginatedData: [],
        totalPages: 0,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      };
    }

    const { rows } = data;
    const totalRows = rows.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRows);
    const paginatedData = rows.slice(startIndex, endIndex);

    return {
      paginatedData,
      totalPages,
      currentPage: page,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      totalRows,
    };
  }, [data, page, pageSize]);
};

/**
 * 数据搜索Hook
 * 提供数据搜索和过滤功能
 * 
 * @param data 原始数据
 * @param searchTerm 搜索词
 * @param searchColumns 搜索的列索引数组
 * @returns 过滤后的数据
 */
export const useSearchableData = (
  data: QueryResult | null,
  searchTerm: string = '',
  searchColumns?: number[]
) => {
  return useMemo(() => {
    if (!data || !searchTerm.trim()) {
      return data;
    }

    const { rows, columns } = data;
    const term = searchTerm.toLowerCase();
    const columnsToSearch = searchColumns || Array.from({ length: columns.length }, (_, i) => i);

    const filteredRows = rows.filter(row => {
      return columnsToSearch.some(colIndex => {
        const cellValue = row[colIndex];
        if (cellValue === null || cellValue === undefined) return false;
        return String(cellValue).toLowerCase().includes(term);
      });
    });

    return {
      ...data,
      rows: filteredRows,
      totalRows: filteredRows.length,
    };
  }, [data, searchTerm, searchColumns]);
};