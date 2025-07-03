import React, { useMemo, useCallback, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { TableData, CellValue } from '../types/data';

interface VirtualizedTableProps {
  data: TableData;
  height?: number;
  rowHeight?: number;
  onCellClick?: (rowIndex: number, columnIndex: number, value: CellValue) => void;
  sortable?: boolean;
  filterable?: boolean;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  [key: string]: string;
}

const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  height = 400,
  rowHeight = 35,
  onCellClick,
  sortable = true,
  filterable = true,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});

  // 处理排序
  const handleSort = useCallback((columnKey: string) => {
    if (!sortable) return;
    
    setSortConfig(current => {
      if (current?.key === columnKey) {
        return current.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, [sortable]);

  // 处理过滤
  const handleFilter = useCallback((columnKey: string, value: string) => {
    setFilters(current => ({
      ...current,
      [columnKey]: value,
    }));
  }, []);

  // 处理数据排序和过滤
  const processedData = useMemo(() => {
    let result = [...data.rows];

    // 应用过滤
    if (Object.keys(filters).length > 0) {
      result = result.filter(row => {
        return Object.entries(filters).every(([columnKey, filterValue]) => {
          if (!filterValue) return true;
          const columnIndex = data.columns.findIndex(col => col === columnKey);
          if (columnIndex === -1) return true;
          const cellValue = row[columnIndex];
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        });
      });
    }

    // 应用排序
    if (sortConfig) {
      const columnIndex = data.columns.findIndex(col => col === sortConfig.key);
      if (columnIndex !== -1) {
        result.sort((a, b) => {
          const aValue = a[columnIndex];
          const bValue = b[columnIndex];
          
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          
          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, sortConfig, filters]);

  // 表头组件
  const TableHeader = useMemo(() => (
    <div className="table-header" style={{ display: 'flex', borderBottom: '2px solid #e2e8f0' }}>
      {data.columns.map((column, index) => (
        <div
          key={column}
          className="table-header-cell"
          style={{
            flex: 1,
            padding: '12px 8px',
            fontWeight: 'bold',
            backgroundColor: '#f8fafc',
            cursor: sortable ? 'pointer' : 'default',
            borderRight: index < data.columns.length - 1 ? '1px solid #e2e8f0' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
          onClick={() => handleSort(column)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{column}</span>
            {sortable && sortConfig && sortConfig.key === column && (
              <span style={{ fontSize: '12px' }}>
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
          {filterable && (
            <input
              type="text"
              placeholder="过滤..."
              value={filters[column] || ''}
              onChange={(e) => handleFilter(column, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '4px 6px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                width: '100%',
              }}
            />
          )}
        </div>
      ))}
    </div>
  ), [data.columns, sortConfig, filters, sortable, filterable, handleSort, handleFilter]);

  // 行组件
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = processedData[index];
    
    return (
      <div style={style} className="table-row">
        <div 
          style={{ 
            display: 'flex', 
            height: '100%',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
          }}
        >
          {row.map((cell, cellIndex) => (
            <div
              key={cellIndex}
              className="table-cell"
              style={{
                flex: 1,
                padding: '8px',
                borderRight: cellIndex < row.length - 1 ? '1px solid #e2e8f0' : 'none',
                cursor: onCellClick ? 'pointer' : 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={() => onCellClick?.(index, cellIndex, cell)}
              title={String(cell)}
            >
              {cell === null || cell === undefined ? (
                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>
              ) : (
                String(cell)
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }, [processedData, onCellClick]);

  return (
    <div className="virtualized-table" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      {TableHeader}
      <List
        height={height}
        itemCount={processedData.length}
        itemSize={rowHeight}
        width="100%"
      >
        {Row}
      </List>
      <div 
        style={{ 
          padding: '8px 12px', 
          fontSize: '12px', 
          color: '#6b7280', 
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        显示 {processedData.length} 行数据
        {Object.keys(filters).length > 0 && (
          <span> (已过滤，原始数据 {data.rows.length} 行)</span>
        )}
      </div>
    </div>
  );
};

export default VirtualizedTable;