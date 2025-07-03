// React 19 + TypeScript 5.8.3 + DaisyUI 优化的虚拟化表格组件
import React, { useState, useRef, useCallback, useMemo, useLayoutEffect, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import type {
  VirtualizedTableProps,
  TableRow,
  SortConfig,
  CellValue,
  TableState,
  ColumnDefinition,
} from '../types/table';
import { useTableI18n } from '../hooks/useTableI18n';
import { ErrorBoundary } from './ErrorBoundary';

// 防抖工具函数 - React 19 优化
const createDebounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T => {
  let timeoutId: number | undefined;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait) as unknown as number;
  }) as T;
};

// 数据验证和转换工具
const validateAndTransformData = <T extends TableRow>(
  data: VirtualizedTableProps<T>['data']
) => {
  if (!data?.columns?.length || !data?.rows?.length) {
    throw new Error('Invalid table data: columns and rows are required');
  }

  // 转换旧格式到新格式
  const columns: ColumnDefinition[] = data.columns.map((col, index) => {
    if (typeof col === 'string') {
      return {
        key: `col_${index}`,
        title: col,
        dataType: 'string' as const,
        sortable: true,
      };
    }
    return col;
  });

  return { ...data, columns };
};

// 排序工具函数 - 类型安全的排序
const createSorter = <T extends TableRow>(
  columns: ColumnDefinition[],
  sortConfig: SortConfig | null
) => {
  if (!sortConfig) return null;

  const column = columns.find(col => col.key === sortConfig.columnKey);
  if (!column) return null;

  return (a: T, b: T): number => {
    const aVal = a[sortConfig.columnKey as keyof T] as CellValue;
    const bVal = b[sortConfig.columnKey as keyof T] as CellValue;

    // 处理 null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
    if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;

    // 类型特定的比较
    let comparison = 0;
    switch (column.dataType) {
      case 'number':
        comparison = Number(aVal) - Number(bVal);
        break;
      case 'date':
        comparison = new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
        break;
      case 'boolean':
        comparison = Number(aVal) - Number(bVal);
        break;
      default:
        comparison = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  };
};

// 表头组件 - React 19 memo 优化
const TableHeader = memo<{
  columns: ColumnDefinition[];
  sortConfig: SortConfig | null;
  onSort: (columnKey: string) => void;
  onClearSort: () => void;
  totalWidth: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}>(({ columns, sortConfig, onSort, onClearSort, totalWidth, t }) => {
  return (
    <div
      className="flex items-center bg-base-200 border-b border-base-300 sticky top-0 z-10"
      style={{ width: totalWidth }}
    >
      {columns.map((column) => {
        const isSorted = sortConfig?.columnKey === column.key;
        const sortDirection = isSorted ? sortConfig.direction : null;

        return (
          <div
            key={column.key}
            className={`
              flex items-center justify-between px-3 py-2 text-sm font-medium
              border-r border-base-300 last:border-r-0 cursor-pointer
              hover:bg-base-300 transition-colors duration-200
              ${isSorted ? 'bg-primary/10 text-primary' : 'text-base-content'}
            `}
            style={{ width: column.width || 150, minWidth: column.minWidth || 100 }}
            onClick={() => column.sortable !== false && onSort(column.key)}
            role="columnheader"
            aria-sort={
              isSorted
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && column.sortable !== false) {
                e.preventDefault();
                onSort(column.key);
              }
            }}
          >
            <span className="truncate" title={column.title}>
              {column.title}
            </span>
            {column.sortable !== false && (
              <div className="ml-2 flex flex-col">
                <div
                  className={`w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent ${
                    isSorted && sortDirection === 'asc'
                      ? 'border-b-primary'
                      : 'border-b-base-content/30'
                  }`}
                />
                <div
                  className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-transparent mt-0.5 ${
                    isSorted && sortDirection === 'desc'
                      ? 'border-t-primary'
                      : 'border-t-base-content/30'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
      {sortConfig && (
        <button
          className="ml-2 px-2 py-1 text-xs bg-error text-error-content rounded hover:bg-error/80 transition-colors"
          onClick={onClearSort}
          title={t('clearSort')}
        >
          ✕
        </button>
      )}
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

// 表格行组件 - React 19 优化
const TableRow = memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    rows: TableRow[];
    columns: ColumnDefinition[];
    onCellClick?: (event: { rowIndex: number; columnKey: string; value: CellValue; row: TableRow }) => void;
    onRowClick?: (event: { rowIndex: number; row: TableRow }) => void;
    rowClassName?: (row: TableRow, index: number) => string;
    cellClassName?: (value: CellValue, columnKey: string) => string;
  };
}>(({ index, style, data }) => {
  const { rows, columns, onCellClick, onRowClick, rowClassName, cellClassName } = data;
  const row = rows[index];

  const handleRowClick = useCallback(() => {
    onRowClick?.({ rowIndex: index, row });
  }, [index, row, onRowClick]);

  const handleCellClick = useCallback(
    (columnKey: string, value: CellValue) => {
      onCellClick?.({ rowIndex: index, columnKey, value, row });
    },
    [index, row, onCellClick]
  );

  return (
    <div
      style={style}
      className={`
        flex items-center border-b border-base-200 hover:bg-base-200 transition-colors
        ${index % 2 === 0 ? 'bg-base-50' : 'bg-base-100'}
        ${rowClassName?.(row, index) || ''}
      `}
      onClick={handleRowClick}
      role="row"
      aria-rowindex={index + 1}
    >
      {columns.map((column) => {
        const value = row[column.key as keyof TableRow];
        const displayValue = column.formatter ? column.formatter(value) : String(value ?? '');

        return (
          <div
            key={column.key}
            className={`
              px-3 py-2 text-sm border-r border-base-200 last:border-r-0 truncate
              ${cellClassName?.(value, column.key) || ''}
            `}
            style={{ width: column.width || 150, minWidth: column.minWidth || 100 }}
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(column.key, value);
            }}
            role="gridcell"
            title={displayValue}
          >
            {displayValue}
          </div>
        );
      })}
    </div>
  );
});

TableRow.displayName = 'TableRow';

// 主表格组件
const VirtualizedTable = <T extends TableRow = TableRow>({
  data: rawData,
  height = 400,
  virtualization = { rowHeight: 35, overscanCount: 5 },
  eventHandlers = {},
  features = {
    sortable: true,
    fullscreen: true,
    resizable: false,
    selection: false,
  },
  styling = {},
  i18n,
  performance = {
    enableMemoization: true,
    debounceMs: 100,
    cacheSize: 100,
  },
}: VirtualizedTableProps<T>) => {
  // 验证和转换数据
  const data = useMemo(() => validateAndTransformData(rawData), [rawData]);
  
  // 国际化
  const { t } = useTableI18n(i18n);

  // 状态管理
  const [state, setState] = useState<TableState>({
    isFullscreen: false,
    sortConfig: null,
    selectedRows: new Set(),
    loading: false,
    error: null,
  });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);

  // 排序处理
  const handleSort = useCallback(
    (columnKey: string) => {
      setState((prev) => {
        const newDirection =
          prev.sortConfig?.columnKey === columnKey && prev.sortConfig.direction === 'asc'
            ? 'desc'
            : 'asc';
        return {
          ...prev,
          sortConfig: { columnKey, direction: newDirection },
        };
      });
      eventHandlers.onSort?.(state.sortConfig);
    },
    [eventHandlers, state.sortConfig]
  );

  const handleClearSort = useCallback(() => {
    setState((prev) => ({ ...prev, sortConfig: null }));
    eventHandlers.onSort?.(null);
  }, [eventHandlers]);

  // 排序数据 - 使用 useMemo 优化
  const sortedData = useMemo(() => {
    if (!state.sortConfig) return data.rows;
    
    const sorter = createSorter(data.columns, state.sortConfig);
    return sorter ? [...data.rows].sort(sorter) : data.rows;
  }, [data.rows, data.columns, state.sortConfig]);

  // 列宽计算 - 智能缓存
  const columnWidths = useMemo(() => {
    return data.columns.map((column) => {
      if (column.width) return column.width;
      
      // 基于内容的智能宽度计算
      const headerWidth = column.title.length * 8 + 48;
      const sampleSize = Math.min(20, sortedData.length);
      let maxContentWidth = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const value = sortedData[i]?.[column.key as keyof T];
        const contentWidth = String(value ?? '').length * 7 + 24;
        maxContentWidth = Math.max(maxContentWidth, contentWidth);
      }
      
      const calculatedWidth = Math.max(headerWidth, maxContentWidth);
      return Math.min(
        column.maxWidth || 300,
        Math.max(column.minWidth || 100, calculatedWidth)
      );
    });
  }, [data.columns, sortedData]);

  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  // 创建带有计算宽度的列定义
  const columnsWithWidths = useMemo(() => {
    return data.columns.map((column, index) => ({
      ...column,
      width: columnWidths[index]
    }));
  }, [data.columns, columnWidths]);

  // 滚动同步 - 防抖优化
  const debouncedScrollSync = useMemo(
    () => createDebounce((scrollLeft: number) => {
      if (headerRef.current) {
        headerRef.current.scrollLeft = scrollLeft;
      }
    }, performance.debounceMs || 16),
    [performance.debounceMs]
  );

  const handleScroll = useCallback(
    ({ scrollLeft }: { scrollLeft: number }) => {
      debouncedScrollSync(scrollLeft);
    },
    [debouncedScrollSync]
  );

  // 全屏处理
  const toggleFullscreen = useCallback(() => {
    setState((prev) => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // 表格内容组件
  const TableContent = memo(() => (
    <div className="flex flex-col h-full overflow-x-auto">
      {/* 表头 */}
      <div ref={headerRef} className="flex-shrink-0">
        <TableHeader
           columns={columnsWithWidths}
           sortConfig={state.sortConfig}
           onSort={handleSort}
           onClearSort={handleClearSort}
           totalWidth={totalWidth}
           t={(key: string, params?: Record<string, string | number>) => t(key as any, params)}
         />
      </div>

      {/* 表格主体 */}
      <div className="flex-1 overflow-hidden">
        <List
          ref={listRef}
          height={state.isFullscreen ? height - 120 : height - 60}
          itemCount={sortedData.length}
          itemSize={virtualization.rowHeight}
          width={totalWidth}
          onScroll={(props) => handleScroll({ scrollLeft: props.scrollOffset || 0 })}
          overscanCount={virtualization.overscanCount}
          itemData={{
            rows: sortedData,
            columns: columnsWithWidths,
            onCellClick: eventHandlers.onCellClick as any,
               onRowClick: eventHandlers.onRowClick as any,
             rowClassName: styling.rowClassName as any,
             cellClassName: styling.cellClassName,
          }}
        >
          {TableRow}
        </List>
      </div>

      {/* 底部信息栏 */}
      <div className="p-3 border-t border-base-300 bg-base-200 text-xs text-base-content/70 flex justify-between items-center">
        <span>{t('totalRows', { count: sortedData.length })}</span>
        <div className="flex items-center gap-2">
          {state.sortConfig && (
            <button
              className="btn btn-xs btn-outline"
              onClick={handleClearSort}
              title={t('clearSort')}
            >
              {t('clearSort')}
            </button>
          )}
          {features.fullscreen && (
            <button
              className="btn btn-xs btn-primary"
              onClick={toggleFullscreen}
              title={state.isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            >
              {state.isFullscreen ? '⤓' : '⤢'}
            </button>
          )}
        </div>
      </div>
    </div>
  ));

  // 主渲染
  return (
    <div className={`virtualized-table ${styling.className || ''}`}>
      <div
        ref={containerRef}
        className="border border-base-300 rounded-lg overflow-hidden bg-base-100"
        style={{ height }}
      >
        <TableContent />
      </div>

      {/* 全屏模态框 */}
      {state.isFullscreen && (
        <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
          <div className="p-4 border-b border-base-300 bg-base-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">{t('fullscreen')}</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={toggleFullscreen}
              title={t('exitFullscreen')}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TableContent />
          </div>
        </div>
      )}
    </div>
  );
};

// 错误边界包装组件
const VirtualizedTableWithErrorBoundary = <T extends TableRow = TableRow>(
  props: VirtualizedTableProps<T>
) => {
  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('VirtualizedTable Error:', error, errorInfo);
    // 可以在这里添加错误上报逻辑
  }, []);

  return (
    <ErrorBoundary onError={handleError}>
      <VirtualizedTable {...props} />
    </ErrorBoundary>
  );
};

export default VirtualizedTableWithErrorBoundary;
export { VirtualizedTable };
export type { VirtualizedTableProps, TableRow, SortConfig };