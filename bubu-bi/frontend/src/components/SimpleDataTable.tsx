import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { UI_CONSTANTS, STYLE_CLASSES } from '../constants/ui';
import { isEscapePressed } from '../utils/keyboard';

interface SimpleDataTableProps {
  data: {
    columns: string[];
    rows: any[][];
    total: number;
  };
  onExport?: () => void;
  definition?: string;
}

export const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ 
  data, 
  onExport, 
  definition 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // 优化的全屏切换函数
  const toggleFullscreen = useCallback((enable: boolean) => {
    if (isTransitioning) return; // 防止重复点击
    
    setIsTransitioning(true);
    
    if (enable) {
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsFullscreen(false);
      document.body.style.overflow = 'unset';
    }
    
    // 动画完成后重置过渡状态
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
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, isTransitioning, toggleFullscreen]);

  // 清理函数
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // 排序处理
  const handleSort = (column: string) => {
    setSortConfig(current => {
      if (current?.key === column) {
        return current.direction === 'asc' 
          ? { key: column, direction: 'desc' }
          : null;
      }
      return { key: column, direction: 'asc' };
    });
  };

  // 优化的排序数据 - 使用分页和延迟计算
  const sortedData = useMemo(() => {
    if (!data || !sortConfig) return data;
    
    const columnIndex = data.columns.indexOf(sortConfig.key);
    if (columnIndex === -1) return data;

    // 对于大数据集，只排序前1000条用于显示
    const maxSortRows = Math.min(data.rows.length, UI_CONSTANTS.TABLE.MAX_SORT_ROWS);
    const rowsToSort = data.rows.slice(0, maxSortRows);
    
    const sortedRows = rowsToSort.sort((a, b) => {
      const aVal = a[columnIndex];
      const bVal = b[columnIndex];
      
      // 快速数值比较
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // 优化的字符串比较
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const result = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? result : -result;
    });
    
    // 如果有剩余数据，追加到末尾
    const remainingRows = data.rows.length > maxSortRows ? data.rows.slice(maxSortRows) : [];
    const finalRows = [...sortedRows, ...remainingRows];

    return { ...data, rows: finalRows };
  }, [data, sortConfig]);

  // 获取要显示的数据（最多50条）
  const displayData = useMemo(() => {
    const dataToUse = sortedData || data;
    return {
      ...dataToUse,
      rows: dataToUse.rows.slice(0, UI_CONSTANTS.TABLE.VISIBLE_ROWS)
    };
  }, [sortedData, data]);

  if (!data || !data.columns || !data.rows) {
    return (
      <div className="p-4 bg-base-200 rounded-lg text-center text-base-content/60">
        暂无数据
      </div>
    );
  }

  return (
    <>
      <div className={STYLE_CLASSES.CARD_BASE + " overflow-hidden"}>
        {/* 标题栏 */}
        <TableHeader 
          definition={definition}
          total={data.total}
          onExport={onExport}
          onFullscreen={() => toggleFullscreen(true)}
          isTransitioning={isTransitioning}
          hasData={data.rows.length > 0}
        />

        <div className="overflow-x-auto">
          <DataTable 
            data={sortedData || data}
            sortConfig={sortConfig}
            onSort={handleSort}
            maxRows={UI_CONSTANTS.TABLE.PREVIEW_ROWS}
          />
        </div>
        
        {data.total > UI_CONSTANTS.TABLE.PREVIEW_ROWS && (
          <div className="p-3 bg-base-200 text-center text-fluid-sm text-base-content/60">
            显示前 {UI_CONSTANTS.TABLE.PREVIEW_ROWS} 条，共 {data.total} 条数据
          </div>
        )}
      </div>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <FullscreenModal
          data={sortedData || data}
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
};

// 表格头部组件
interface TableHeaderProps {
  definition?: string;
  total: number;
  onExport?: () => void;
  onFullscreen: () => void;
  isTransitioning: boolean;
  hasData: boolean;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  definition,
  total,
  onExport,
  onFullscreen,
  isTransitioning,
  hasData
}) => (
  <div className="p-3 border-b border-base-300 bg-base-200">
    <div className={STYLE_CLASSES.FLEX_BETWEEN}>
      <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2}`}>
        <span className="text-lg">{UI_CONSTANTS.ICONS.TABLE}</span>
        <h3 className="font-medium">{definition || "数据表格"}</h3>
        <span className={`${STYLE_CLASSES.TEXT_SMALL} text-base-content/50`}>({total} 条记录)</span>
      </div>
      <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2}`}>
        {/* 下载按钮 */}
        <button 
          className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_SM}`}
          onClick={onExport}
          disabled={!hasData}
          title="下载全部数据"
        >
          {UI_CONSTANTS.ICONS.EXPORT} 下载
        </button>
        <button 
          className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_SM}`}
          onClick={onFullscreen}
          disabled={isTransitioning}
          title="全屏显示"
        >
          {UI_CONSTANTS.ICONS.FULLSCREEN} 全屏
        </button>
      </div>
    </div>
  </div>
);

// 数据表格组件
interface DataTableProps {
  data: {
    columns: string[];
    rows: any[][];
    total: number;
  };
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (column: string) => void;
  maxRows?: number;
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  sortConfig,
  onSort,
  maxRows
}) => {
  const displayRows = maxRows ? data.rows.slice(0, maxRows) : data.rows;
  
  return (
    <table className="table table-zebra w-full">
      <thead>
        <tr className="bg-base-200">
          {data.columns.map((column, index) => (
            <th 
              key={index} 
              className="font-medium text-base-content cursor-pointer hover:bg-base-300 transition-colors"
              onClick={() => onSort(column)}
            >
              <div className="flex items-center space-x-1">
                <span>{column}</span>
                {sortConfig?.key === column && (
                  <span className="text-xs transition-transform duration-150">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-base-200 transition-colors">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="text-base-content select-text" style={{ userSelect: 'text' }}>
                {cell !== null && cell !== undefined ? String(cell) : '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// 全屏模态框组件
interface FullscreenModalProps {
  data: {
    columns: string[];
    rows: any[][];
    total: number;
  };
  definition?: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (column: string) => void;
  onExport?: () => void;
  onClose: () => void;
  isTransitioning: boolean;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  data,
  definition,
  sortConfig,
  onSort,
  onExport,
  onClose,
  isTransitioning
}) => (
  <>
    {/* Modal Backdrop */}
    <div 
      className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={onClose}
    />
    
    {/* Modal Content */}
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${
      isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
    }`}>
      <div className="w-full h-full max-w-full max-h-full bg-base-100 rounded-lg shadow-2xl border border-base-300 flex flex-col overflow-hidden">
        {/* Modal 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200 flex-shrink-0">
          <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2}`}>
            <span className="text-lg">{UI_CONSTANTS.ICONS.TABLE}</span>
            <h3 className="font-semibold">{definition || "数据表格"} - 全屏模式</h3>
            <span className={`${STYLE_CLASSES.TEXT_SMALL} text-base-content/50`}>({data.total} 条记录)</span>
          </div>
          <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2}`}>
            <button 
              className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_SM}`}
              onClick={onExport}
              disabled={!data.rows.length}
              title="下载全部数据"
            >
              {UI_CONSTANTS.ICONS.EXPORT} 下载
            </button>
            <button 
              className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_SM}`}
              onClick={onClose}
              disabled={isTransitioning}
              title="退出全屏 (ESC)"
            >
              {UI_CONSTANTS.ICONS.CLOSE} 关闭
            </button>
          </div>
        </div>

        {/* Modal 表格内容 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto h-full">
            <table className="table table-zebra table-sm w-full">
              <thead className="sticky top-0 bg-base-200 z-10">
                <tr>
                  {data.columns.map((column, index) => (
                    <th 
                      key={`header-${index}`} 
                      className="cursor-pointer hover:bg-base-300 font-medium transition-colors duration-150"
                      onClick={() => onSort(column)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column}</span>
                        {sortConfig?.key === column && (
                          <span className="text-fluid-xs transition-transform duration-150">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, UI_CONSTANTS.TABLE.VISIBLE_ROWS).map((row, index) => (
                  <tr key={`fullscreen-row-${index}`} className="hover:bg-base-200 transition-colors duration-150">
                    {row.map((cell, cellIndex) => (
                      <td key={`fullscreen-cell-${index}-${cellIndex}`} className="px-4 py-2 select-text" style={{ userSelect: 'text' }}>
                        {cell === null || cell === undefined ? (
                          <span className="text-base-content/30 italic select-text">null</span>
                        ) : (
                          <div className="max-w-xs overflow-hidden">
                            <span className="block truncate select-text" title={String(cell)} style={{ userSelect: 'text' }}>
                              {String(cell)}
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 底部状态栏 */}
        <div className="p-4 border-t border-base-300 bg-base-200 flex-shrink-0">
          <div className={STYLE_CLASSES.FLEX_BETWEEN}>
            <div className={`${STYLE_CLASSES.TEXT_SMALL} text-base-content/70`}>
              💡 提示：点击列标题可以排序，按 ESC 键或点击背景退出全屏
            </div>
            <div className={`${STYLE_CLASSES.TEXT_SMALL} text-base-content/50`}>
              显示前 {Math.min(UI_CONSTANTS.TABLE.VISIBLE_ROWS, data.total)} 条，共 {data.total} 条记录，{data.columns.length} 个字段
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

export default SimpleDataTable;