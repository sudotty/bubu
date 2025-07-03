import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { main } from '../../wailsjs/go/models';
import ChartVisualization from './ChartVisualization';
import EnhancedInsights from './EnhancedInsights';
import SimpleTable from './SimpleTable';
import { adaptTableData, optimizeTableData, type TableData } from '../utils/tableDataAdapter';
import { getColumnDisplayName, getColumnKey, type ColumnType } from '../utils/columnUtils';
import { TableErrorBoundary } from './ErrorBoundary';

// 类型定义
type QueryResult = main.QueryResult;
type ViewMode = 'table' | 'insights' | 'chart';
type SortDirection = 'asc' | 'desc';
type InsightType = 'summary' | 'trend' | 'anomaly' | 'recommendation';
type VisualizationType = 'bar' | 'line' | 'pie' | 'scatter';

// 常量定义
const CONFIG = {
  VIRTUALIZATION: {
    ROW_HEIGHT: 40,
    VISIBLE_ROWS: 50,
    MAX_SORT_ROWS: 1000,
    SCROLL_DEBOUNCE_MS: 16,
    TRANSITION_DURATION_MS: 300,
  },
  INSIGHTS: {
    MAX_COUNT: 6,
    OUTLIER_THRESHOLD: 2, // 标准差倍数
  },
  STYLES: {
    summary: 'bg-info/10 border-info/20 text-info',
    trend: 'bg-success/10 border-success/20 text-success',
    anomaly: 'bg-warning/10 border-warning/20 text-warning',
    recommendation: 'bg-primary/10 border-primary/20 text-primary',
  } as Record<InsightType, string>,
} as const;

// 接口定义
interface DataInsight {
  type: InsightType;
  title: string;
  description: string;
  value?: string | number;
  confidence: number;
  icon: string;
}

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface VirtualizationData {
  visibleRows: any[];
  startIndex: number;
  startOffset: number;
  endOffset: number;
}

interface EnhancedResultDisplayProps {
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  query: string;
  onExport?: () => void;
  onCopy?: () => void;
  onVisualize?: (type: VisualizationType) => void;
}

// 优化的表格行组件
const TableRow = React.memo<{ row: any[]; rowIndex: number }>(({ row, rowIndex }) => (
  <tr className={`hover:bg-base-200 transition-colors duration-150 ${
    rowIndex % 2 === 0 ? 'bg-base-50' : 'bg-base-100'
  }`}>
    {row.map((cell, cellIndex) => (
      <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-2">
        <TableCell value={cell} />
      </td>
    ))}
  </tr>
));

TableRow.displayName = 'TableRow';

// 状态组件
const LoadingState: React.FC = () => (
  <div className="bg-base-100 rounded-lg border border-base-300 p-8">
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="loading loading-spinner loading-lg text-primary"></div>
      <div className="text-center">
        <h3 className="font-semibold text-lg mb-2">🤖 AI正在分析数据</h3>
        <p className="text-base-content/70">请稍候，正在为您生成分析结果...</p>
      </div>
    </div>
  </div>
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="bg-base-100 rounded-lg border border-base-300 p-8">
    <div className="text-center">
      <div className="text-4xl mb-4">❌</div>
      <h3 className="font-semibold text-lg mb-2 text-error">分析遇到问题</h3>
      <p className="text-base-content/70 mb-4">{error}</p>
      <div className="text-sm text-base-content/50">
        <p>💡 建议：</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>检查查询语法是否正确</li>
          <li>确认数据源是否可访问</li>
          <li>尝试简化查询条件</li>
        </ul>
      </div>
    </div>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="bg-base-100 rounded-lg border border-base-300 p-8">
    <div className="text-center">
      <div className="text-4xl mb-4">📭</div>
      <h3 className="font-semibold text-lg mb-2">分析完成</h3>
      <p className="text-base-content/70 mb-4">未找到符合条件的数据</p>
      <div className="text-sm text-base-content/50">
        <p>💡 建议：</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>检查筛选条件是否过于严格</li>
          <li>尝试扩大查询范围</li>
          <li>确认数据源中是否有相关数据</li>
        </ul>
      </div>
    </div>
  </div>
);

// 表格单元格组件
const TableCell = React.memo<{ value: any }>(({ value }) => {
  if (value === null || value === undefined) {
    return <span className="text-base-content/30 italic">null</span>;
  }
  
  const stringValue = String(value);
  return (
    <div className="max-w-xs overflow-hidden">
      <span className="block truncate" title={stringValue}>
        {stringValue}
      </span>
    </div>
  );
});

TableCell.displayName = 'TableCell';

// 自定义hooks
const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleFullscreen = useCallback((enable: boolean) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setIsFullscreen(enable);
    document.body.style.overflow = enable ? 'hidden' : 'unset';
    
    setTimeout(() => setIsTransitioning(false), CONFIG.VIRTUALIZATION.TRANSITION_DURATION_MS);
  }, [isTransitioning]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && !isTransitioning) {
        toggleFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen, isTransitioning, toggleFullscreen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return { isFullscreen, isTransitioning, toggleFullscreen };
};

const useVirtualization = (data: QueryResult | null, sortConfig: SortConfig | null) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const sortedData = useMemo(() => {
    if (!data || !sortConfig) return data;

    const { columns, rows } = data;
    const columnIndex = columns.indexOf(sortConfig.key);
    if (columnIndex === -1) return data;

    const maxSortRows = Math.min(rows.length, CONFIG.VIRTUALIZATION.MAX_SORT_ROWS);
    const rowsToSort = rows.slice(0, maxSortRows);
    
    const sortedRows = rowsToSort.sort((a, b) => {
      const aVal = a[columnIndex];
      const bVal = b[columnIndex];
      
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const result = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? result : -result;
    });
    
    const remainingRows = rows.length > maxSortRows ? rows.slice(maxSortRows) : [];
    return { ...data, rows: [...sortedRows, ...remainingRows] };
  }, [data, sortConfig]);

  const virtualizationData = useMemo((): VirtualizationData => {
    if (!sortedData?.rows) {
      return { visibleRows: [], startIndex: 0, startOffset: 0, endOffset: 0 };
    }

    const totalRows = sortedData.rows.length;
    const startIndex = Math.floor(scrollTop / CONFIG.VIRTUALIZATION.ROW_HEIGHT);
    const endIndex = Math.min(startIndex + CONFIG.VIRTUALIZATION.VISIBLE_ROWS, totalRows);
    
    const visibleRows = sortedData.rows.slice(startIndex, endIndex);
    const startOffset = startIndex * CONFIG.VIRTUALIZATION.ROW_HEIGHT;
    const endOffset = (totalRows - endIndex) * CONFIG.VIRTUALIZATION.ROW_HEIGHT;

    return { visibleRows, startIndex, startOffset, endOffset };
  }, [sortedData, scrollTop]);

  const handleScroll = useCallback(
    useMemo(() => {
      let timeoutId: number;
      return (e: React.UIEvent<HTMLDivElement>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          setScrollTop(e.currentTarget.scrollTop);
        }, CONFIG.VIRTUALIZATION.SCROLL_DEBOUNCE_MS);
      };
    }, []),
    []
  );

  return { sortedData, virtualizationData, handleScroll };
};

export const EnhancedResultDisplay: React.FC<EnhancedResultDisplayProps> = memo(({
  result,
  error,
  loading,
  query,
  onExport,
  onCopy,
  onVisualize
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { isFullscreen, isTransitioning, toggleFullscreen } = useFullscreen();
  const { sortedData, virtualizationData, handleScroll } = useVirtualization(result, sortConfig);



  // 生成数据洞察
  const insights = useMemo((): DataInsight[] => {
    if (!result || !result.rows || result.rows.length === 0) return [];

    const insights: DataInsight[] = [];
    const { columns, rows, total } = result;

    // 基础统计洞察
    insights.push({
      type: 'summary',
      title: '数据概览',
      description: `共查询到 ${total} 条记录，包含 ${columns.length} 个字段`,
      value: total,
      confidence: 100,
      icon: '📊'
    });

    // 数值字段分析
    columns.forEach((column, colIndex) => {
      const values = rows.map(row => row[colIndex]).filter(val => 
        val !== null && val !== undefined && !isNaN(Number(val))
      ).map(Number);

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        insights.push({
          type: 'summary',
          title: `${getColumnDisplayName(column)} 统计`,
          description: `平均值: ${avg.toFixed(2)}, 最大值: ${max}, 最小值: ${min}`,
          value: avg.toFixed(2),
          confidence: 95,
          icon: '🔢'
        });

        // 异常值检测
        const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
        const outliers = values.filter(val => Math.abs(val - avg) > CONFIG.INSIGHTS.OUTLIER_THRESHOLD * stdDev);
        
        if (outliers.length > 0) {
          insights.push({
            type: 'anomaly',
            title: `${getColumnDisplayName(column)} 异常值`,
            description: `发现 ${outliers.length} 个可能的异常值`,
            value: outliers.length,
            confidence: 80,
            icon: '⚠️'
          });
        }
      }
    });

    // 数据质量分析
    const nullCounts = columns.map((_, colIndex) => 
      rows.filter(row => row[colIndex] === null || row[colIndex] === undefined || row[colIndex] === '').length
    );
    
    const maxNulls = Math.max(...nullCounts);
    if (maxNulls > 0) {
      const nullPercentage = (maxNulls / rows.length * 100).toFixed(1);
      insights.push({
        type: 'anomaly',
        title: '数据完整性',
        description: `最高缺失率: ${nullPercentage}%`,
        value: `${nullPercentage}%`,
        confidence: 90,
        icon: '🔍'
      });
    }

    // 基于查询内容的建议
    const queryLower = query.toLowerCase();
    if (queryLower.includes('销售') || queryLower.includes('revenue') || queryLower.includes('sales')) {
      insights.push({
        type: 'recommendation',
        title: '销售分析建议',
        description: '建议按时间维度分析销售趋势，或按产品/地区进行对比分析',
        confidence: 85,
        icon: '💡'
      });
    }

    if (queryLower.includes('用户') || queryLower.includes('customer') || queryLower.includes('user')) {
      insights.push({
        type: 'recommendation',
        title: '用户分析建议',
        description: '建议分析用户行为模式、留存率或用户分群特征',
        confidence: 85,
        icon: '👥'
      });
    }

    return insights.slice(0, CONFIG.INSIGHTS.MAX_COUNT);
  }, [result, query]);

  const { visibleRows, startIndex, startOffset, endOffset } = virtualizationData;

  // 处理排序
  const handleSort = useCallback((column: string) => {
    setSortConfig(current => {
      if (current?.key === column) {
        return current.direction === 'asc' 
          ? { key: column, direction: 'desc' }
          : null;
      }
      return { key: column, direction: 'asc' };
    });
  }, []);

  // 获取洞察类型样式
  const getInsightStyle = useCallback((type: InsightType): string => 
    CONFIG.STYLES[type] || 'bg-base-200 border-base-300', []);

  // 早期返回状态组件
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!result || !result.rows || result.rows.length === 0) return <EmptyState />;

  return (
    <div className="bg-base-100 rounded-lg border border-base-300">
      {/* 标题栏 */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📊</span>
            <h3 className="font-semibold">分析结果</h3>
            <span className="text-sm text-base-content/50">({result.total} 条记录)</span>
          </div>
          
          {/* 视图切换和操作按钮 */}
          <div className="flex items-center space-x-2">
            <div className="tabs tabs-boxed tabs-sm">
              <button 
                className={`tab ${viewMode === 'table' ? 'tab-active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📋 表格
              </button>
              <button 
                className={`tab ${viewMode === 'insights' ? 'tab-active' : ''}`}
                onClick={() => setViewMode('insights')}
              >
                🔍 洞察
              </button>
              <button 
                className={`tab ${viewMode === 'chart' ? 'tab-active' : ''}`}
                onClick={() => setViewMode('chart')}
              >
                📈 图表
              </button>
            </div>
            {/* 下载按钮 */}
            <button 
              className="btn btn-ghost btn-sm"
              onClick={onExport}
              disabled={!result || !result.rows || result.rows.length === 0}
              title="下载全部数据"
            >
              📥 下载
            </button>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => toggleFullscreen(true)}
              disabled={isTransitioning}
              title="全屏显示"
            >
              🔍 全屏
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {viewMode === 'table' && (
          <SimpleTable
             data={{
               columns: result.columns.map((col, index) => ({
                 key: `col_${index}`,
                 title: col,
                 dataType: 'string' as const,
                 sortable: true
               })),
               rows: (sortedData?.rows || []).map(row => {
                 const rowObj: Record<string, any> = {};
                 row.forEach((cell, index) => {
                   rowObj[`col_${index}`] = cell;
                 });
                 return rowObj;
               })
             }}
             features={{
               sortable: true,
               fullscreen: true
             }}
           />
        )}

        {viewMode === 'insights' && (
          <EnhancedInsights 
               data={{
                 columns: result.columns,
                 rows: sortedData?.rows || []
               }}
             />
        )}

        {viewMode === 'chart' && (
          <ChartVisualization 
               config={{
                 type: 'bar',
                 title: '数据图表'
               }}
               data={{
                 columns: result.columns,
                 rows: sortedData?.rows || []
               }}
               onChartTypeChange={(type) => onVisualize?.(type)}
             />
        )}
      </div>

      {/* 操作栏 */}
      <div className="p-4 border-t border-base-300">
        <div className="flex items-center justify-between">
          <div className="text-sm text-base-content/50">
            💡 AI分析洞察: 发现 {insights.length} 个关键发现
          </div>
          <div className="flex space-x-2">
            <button 
              className="btn btn-ghost btn-sm"
              onClick={onCopy}
            >
              📋 复制数据
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={onExport}
            >
              📤 导出Excel
            </button>
          </div>
        </div>
      </div>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <div className={`fixed inset-0 z-50 bg-base-100 transition-all duration-300 ease-in-out ${
          isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          {/* 全屏标题栏 */}
          <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📊</span>
              <h3 className="font-semibold">数据表格 - 全屏模式</h3>
              <span className="text-sm text-base-content/50">({result?.total} 条记录)</span>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                className="btn btn-ghost btn-sm"
                onClick={onCopy}
              >
                📋 复制数据
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={onExport}
              >
                📤 导出Excel
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => toggleFullscreen(false)}
                disabled={isTransitioning}
                title="退出全屏"
              >
                ✕ 退出全屏
              </button>
            </div>
          </div>

          {/* 全屏表格内容 - 虚拟化渲染 */}
          <div className="flex-1 overflow-auto p-4" ref={containerRef} onScroll={handleScroll}>
            <div className="overflow-x-auto h-full">
              <table className="table table-zebra table-sm w-full">
                <thead className="sticky top-0 bg-base-200 z-10">
                  <tr>
                    {result?.columns.map((column, index) => {
                      const columnKey = getColumnKey(column);
                      return (
                        <th 
                          key={`header-${index}`} 
                          className="cursor-pointer hover:bg-base-300 font-medium transition-colors duration-150"
                          onClick={() => handleSort(columnKey)}
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
                  {/* 虚拟化渲染：只渲染可见行 */}
                  <tr style={{ height: startOffset }}><td colSpan={result?.columns.length || 1}></td></tr>
                  {visibleRows.map((row, index) => (
                    <TableRow 
                      key={`row-${startIndex + index}`} 
                      row={row} 
                      rowIndex={startIndex + index}
                    />
                  ))}
                  <tr style={{ height: endOffset }}><td colSpan={result?.columns.length || 1}></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 全屏底部状态栏 */}
          <div className="p-4 border-t border-base-300 bg-base-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-base-content/70">
                💡 提示：点击列标题可以排序，按 ESC 键退出全屏
              </div>
              <div className="text-sm text-base-content/50">
                共 {result?.total} 条记录，{result?.columns.length} 个字段
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

EnhancedResultDisplay.displayName = 'EnhancedResultDisplay';