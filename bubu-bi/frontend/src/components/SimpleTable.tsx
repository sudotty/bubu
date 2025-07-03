import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { VirtualizedTableProps, TableRow, SortConfig, CellValue } from '../types/table';

const SimpleTable = <T extends TableRow = TableRow>({
  data,
  eventHandlers = {},
  features = {},
  styling = {},
  i18n = {},
}: VirtualizedTableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);


  // 默认文本
  const defaultTexts = {
    noData: '暂无数据',
    loading: '加载中...',
    error: '加载失败',
    sortAscending: '升序排列',
    sortDescending: '降序排列',
    ...i18n,
  };

  // 排序逻辑
  const sortedData = useMemo(() => {
    if (!sortConfig || !features.sortable) {
      return data.rows;
    }

    return [...data.rows].sort((a, b) => {
      const aValue = a[sortConfig.columnKey];
      const bValue = b[sortConfig.columnKey];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data.rows, sortConfig, features.sortable]);

  // 排序处理
  const handleSort = (columnKey: string) => {
    if (!features.sortable) return;

    setSortConfig(current => {
      if (current?.columnKey === columnKey) {
        if (current.direction === 'asc') {
          return { columnKey, direction: 'desc' };
        } else {
          return null; // 清除排序
        }
      }
      return { columnKey, direction: 'asc' };
    });
  };

  // 清除排序
  const handleClearSort = () => {
    setSortConfig(null);
  };



  // 渲染单元格内容
  const renderCellContent = (value: CellValue): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // 获取排序图标
  const getSortIcon = (columnKey: string) => {
    if (!features.sortable || sortConfig?.columnKey !== columnKey) {
      return null;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (!data.rows || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {defaultTexts.noData}
      </div>
    );
  }

  return (
    <div className={`relative ${styling.className || ''}`}>

      {/* 表格容器 */}
      <div className="overflow-auto max-h-[600px]">
        <table className="table table-zebra table-pin-rows">
          {/* 表头 */}
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th
                key={column.key}
                className={`${features.sortable ? 'cursor-pointer hover:bg-base-200' : ''}`}
                style={{
                  width: column.width || 'auto',
                  minWidth: column.minWidth || 100,
                }}
                onClick={() => handleSort(column.key)}
              >
                  <div className="flex items-center gap-1">
                    <span>{column.title}</span>
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* 表体 */}
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`hover:bg-base-100 ${styling.rowClassName ? styling.rowClassName(row, rowIndex) : ''}`}
                onClick={() => eventHandlers.onRowClick?.({ rowIndex, row })}
              >
                {data.columns.map((column) => {
                  const cellValue = row[column.key];
                  const cellClassName = styling.cellClassName ? styling.cellClassName(cellValue, column.key) : '';
                  
                  return (
                    <td
                      key={column.key}
                      className={`${cellClassName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        eventHandlers.onCellClick?.({
                          rowIndex,
                          columnKey: column.key,
                          value: cellValue,
                          row
                        });
                      }}
                    >
                      {renderCellContent(cellValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 数据统计 */}
      <div className="p-2 text-sm text-gray-500 border-t">
        共 {data.rows.length} 条数据
        {sortConfig && (
          <span className="ml-2">
            • 按 {data.columns.find(col => col.key === sortConfig.columnKey)?.title} {sortConfig.direction === 'asc' ? '升序' : '降序'}
          </span>
        )}
      </div>
    </div>
  );
};

export default SimpleTable;
export type { VirtualizedTableProps };