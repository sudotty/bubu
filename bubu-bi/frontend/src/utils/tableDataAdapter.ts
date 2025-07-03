/**
 * 表格数据适配器 - 统一处理表格数据转换和优化
 * 符合React 19和TypeScript最新版本优化建议
 */

import { ColumnType, ColumnObject, normalizeColumns, getColumnKey } from './columnUtils';

// 表格数据接口
export interface TableData {
  columns: ColumnObject[];
  rows: Record<string, any>[];
  totalRows?: number;
  hasMore?: boolean;
}

// 原始数据接口
export interface RawTableData {
  columns: ColumnType[];
  rows: any[][];
}

/**
 * 将原始表格数据转换为标准化格式
 * @param data 原始表格数据
 * @returns 标准化表格数据
 */
export const adaptTableData = (data: RawTableData): TableData => {
  const normalizedColumns = normalizeColumns(data.columns);
  
  // 使用Map提升性能，避免重复计算列键
  const columnKeys = normalizedColumns.map(col => col.key);
  
  const rows = data.rows.map((row, rowIndex) => {
    const rowData: Record<string, any> = {};
    
    // 优化：直接使用索引映射，避免查找
    columnKeys.forEach((key, colIndex) => {
      rowData[key] = row[colIndex] ?? null;
    });
    
    return rowData;
  });
  
  return {
    columns: normalizedColumns,
    rows,
    totalRows: rows.length
  };
};

/**
 * 优化大数据集的表格数据
 * @param data 表格数据
 * @param options 优化选项
 * @returns 优化后的表格数据
 */
export const optimizeTableData = (
  data: TableData,
  options: {
    maxRows?: number;
    enableVirtualization?: boolean;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}
): TableData => {
  let { rows } = data;
  const { maxRows = 1000, sortColumn, sortDirection } = options;
  
  // 排序优化
  if (sortColumn && sortDirection) {
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // 分页优化
  const hasMore = rows.length > maxRows;
  if (hasMore) {
    rows = rows.slice(0, maxRows);
  }
  
  return {
    ...data,
    rows,
    hasMore
  };
};

/**
 * 创建空的表格数据
 * @returns 空表格数据
 */
export const createEmptyTableData = (): TableData => ({
  columns: [],
  rows: [],
  totalRows: 0
});

/**
 * 验证表格数据的完整性
 * @param data 表格数据
 * @returns 验证结果
 */
export const validateTableData = (data: any): data is TableData => {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.columns) &&
    Array.isArray(data.rows) &&
    data.columns.every((col: any) => 
      typeof col === 'object' && 
      typeof col.key === 'string'
    )
  );
};