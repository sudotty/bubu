/**
 * 列工具函数 - 统一处理列显示和类型转换
 * 符合React 19和TypeScript最新版本优化建议
 */

// 列类型定义
export interface ColumnObject {
  key: string;
  title?: string;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  formatter?: (value: any) => string;
}

export type ColumnType = string | ColumnObject;

/**
 * 获取列的显示名称
 * @param column 列定义（字符串或对象）
 * @returns 显示名称
 */
export const getColumnDisplayName = (column: ColumnType): string => {
  return typeof column === 'string' ? column : column.title || column.key || 'Unknown';
};

/**
 * 获取列的键值
 * @param column 列定义
 * @returns 列键值
 */
export const getColumnKey = (column: ColumnType): string => {
  return typeof column === 'string' ? column : column.key;
};

/**
 * 检查列是否可排序
 * @param column 列定义
 * @returns 是否可排序
 */
export const isColumnSortable = (column: ColumnType): boolean => {
  return typeof column === 'string' ? true : column.sortable !== false;
};

/**
 * 将字符串列数组转换为列对象数组
 * @param columns 字符串列数组
 * @returns 列对象数组
 */
export const normalizeColumns = (columns: ColumnType[]): ColumnObject[] => {
  return columns.map((col, index) => 
    typeof col === 'string' 
      ? {
          key: col,
          title: col,
          dataType: 'string' as const,
          sortable: true
        }
      : col
  );
};

/**
 * 类型守卫：检查是否为列对象
 * @param column 列定义
 * @returns 是否为列对象
 */
export const isColumnObject = (column: ColumnType): column is ColumnObject => {
  return typeof column === 'object' && column !== null && 'key' in column;
};