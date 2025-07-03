/**
 * 简单数据表格组件 - 优化版本
 * 符合React 19和TypeScript最新版本优化建议
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { UI_CONSTANTS, STYLE_CLASSES } from '../constants/ui';
import { isEscapePressed } from '../utils/keyboard';
import { adaptTableData, optimizeTableData, type TableData } from '../utils/tableDataAdapter';
import { getColumnDisplayName, getColumnKey, type ColumnType } from '../utils/columnUtils';
import { TableErrorBoundary } from './ErrorBoundary';

interface SimpleDataTableProps {
  data: {
    columns: ColumnType[];
    rows: any[][];
    total: number;
  };
  onExport?: () => void;
  definition?: string;
  maxRows?: number;
  enableVirtualization?: boolean;
}

export const SimpleDataTable: React.FC<SimpleDataTableProps> = memo(({
  data,
  onExport,
  definition,
  maxRows = 1000,
  enableVirtualization = false
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 使用数据适配器转换和优化数据
  const tableData = useMemo(() => {
    const adaptedData = adaptTableData(data);
    return optimizeTableData(adaptedData, {
      maxRows,
      enableVirtualization,
      sortColumn: sortConfig?.key,
      sortDirection: sortConfig?.direction
    });
  }, [data, maxRows, enableVirtualization, sortConfig]);

  // 优化的全屏切换函数
  const toggleFullscreen = useCallback((enable: boolean) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    
    if (enable) {
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsFullscreen(false);
      document.body.style.overflow = 'unset';
    }
    
    setTimeout(() => setIsTransitioning(false), UI_CONSTANTS.ANIMATION.TRANSITION_DURATION);
  }, [isTransitioning]);

  // 监听ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEscapePressed(event) && isFullscreen && !isTransitioning) {
        toggleFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen, isTransitioning, toggleFullscreen]);

  // 排序处理函数
  const handleSort = useCallback((columnKey: string) => {
    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isFullscreen]);

  if (!tableData.rows.length) {
    return (
      <div className="text-center py-8 text-base-content/60">
        <p>暂无数据</p>
      </div>
    );
  }

  return (
    <>
      {/* 普通视图 */}
      <div className={`${STYLE_CLASSES.CARD_BASE} ${isFullscreen ? 'hidden' : ''}`}>
        <div className="card-header flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">数据表格</h3>
            {definition && (
              <p className="text-sm text-base-content/60 mt-1">{definition}</p>
            )}
          </div>
          <div className="flex space-x-2">
            {onExport && (
              <button
                onClick={onExport}
                className="btn btn-sm btn-outline"
                title="导出数据"
              >
                导出
              </button>
            )}
            <button
              onClick={() => toggleFullscreen(true)}
              className="btn btn-sm btn-outline"
              title="全屏查看"
              disabled={isTransitioning}
            >
              全屏
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <DataTable
            data={tableData}
            sortConfig={sortConfig}
            onSort={handleSort}
            maxRows={50}
          />
        </div>
        
        {tableData.hasMore && (
          <div className="text-center mt-4 text-sm text-base-content/60">
            显示前 {Math.min(50, tableData.rows.length)} 行，共 {tableData.totalRows || data.total} 行
          </div>
        )}
      </div>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <FullscreenModal
          data={tableData}
          definition={definition}
          sortConfig={sortConfig}
          onSort={handleSort}
          onExport={onExport}
          onClose={() => toggleFullscreen(false)}
          isTransitioning={isTransitioning}
        />
      )}
    </>
  );
});

// 数据表格组件
interface DataTableProps {
  data: TableData;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (column: string) => void;
  maxRows?: number;
}

const DataTable: React.FC<DataTableProps> = memo(({
  data,
  sortConfig,
  onSort,
  maxRows
}) => {
  const displayRows = maxRows ? data.rows.slice(0, maxRows) : data.rows;

  return (
    <TableErrorBoundary>
      <table className="table table-zebra w-full">
        <thead>
          <tr className="bg-base-200">
            {data.columns.map((column) => {
              const columnKey = getColumnKey(column);
              return (
                <th
                  key={columnKey}
                  className="font-medium text-base-content cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => onSort(columnKey)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{getColumnDisplayName(column)}</span>
                    {sortConfig?.key === columnKey && (
                      <span className="text-xs transition-transform duration-150">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, rowIndex) => (
            <tr key={rowIndex} className={`hover:bg-base-200 transition-colors ${
              rowIndex % 2 === 0 ? 'bg-base-50' : 'bg-base-100'
            }`}>
              {data.columns.map((column) => {
                const columnKey = getColumnKey(column);
                return (
                  <td key={columnKey} className="text-base-content select-text" style={{ userSelect: 'text' }}>
                    {row[columnKey] !== null && row[columnKey] !== undefined ? String(row[columnKey]) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableErrorBoundary>
  );
});

// 全屏模态框组件
interface FullscreenModalProps {
  data: TableData;
  definition?: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (column: string) => void;
  onExport?: () => void;
  onClose: () => void;
  isTransitioning: boolean;
}

const FullscreenModal: React.FC<FullscreenModalProps> = memo(({
  data,
  definition,
  sortConfig,
  onSort,
  onExport,
  onClose,
  isTransitioning
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
      {/* 头部工具栏 */}
      <div className="flex-shrink-0 border-b border-base-300 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">数据表格 - 全屏视图</h2>
            {definition && (
              <p className="text-sm text-base-content/60 mt-1">{definition}</p>
            )}
          </div>
          <div className="flex space-x-2">
            {onExport && (
              <button
                onClick={onExport}
                className="btn btn-sm btn-outline"
                title="导出数据"
              >
                导出
              </button>
            )}
            <button
              onClick={onClose}
              className="btn btn-sm btn-outline"
              title="退出全屏"
              disabled={isTransitioning}
            >
              退出全屏
            </button>
          </div>
        </div>
      </div>

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto p-4">
        <DataTable
          data={data}
          sortConfig={sortConfig}
          onSort={onSort}
        />
      </div>

      {/* 底部信息 */}
      <div className="flex-shrink-0 border-t border-base-300 p-4">
        <div className="text-center text-sm text-base-content/60">
          共 {data.totalRows || data.rows.length} 行数据
          {data.hasMore && ' (已优化显示)'}
        </div>
      </div>
    </div>
  );
});

SimpleDataTable.displayName = 'SimpleDataTable';
DataTable.displayName = 'DataTable';
FullscreenModal.displayName = 'FullscreenModal';