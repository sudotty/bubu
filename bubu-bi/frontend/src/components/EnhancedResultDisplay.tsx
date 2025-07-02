import React, { useState, useMemo } from 'react';
import { main } from '../../wailsjs/go/models';

type QueryResult = main.QueryResult;

// 优化的表格行组件，使用React.memo避免不必要的重渲染
const TableRow = React.memo<{ row: any[]; rowIndex: number }>(({ row, rowIndex }) => (
  <tr className="hover:bg-base-200 transition-colors duration-150">
    {row.map((cell, cellIndex) => (
      <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-2">
        {cell === null || cell === undefined ? (
          <span className="text-base-content/30 italic">null</span>
        ) : (
          <div className="max-w-xs overflow-hidden">
            <span className="block truncate" title={String(cell)}>
              {String(cell)}
            </span>
          </div>
        )}
      </td>
    ))}
  </tr>
));

TableRow.displayName = 'TableRow';

interface DataInsight {
  type: 'summary' | 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  value?: string | number;
  confidence: number;
  icon: string;
}

interface EnhancedResultDisplayProps {
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  query: string;
  onExport?: () => void;
  onCopy?: () => void;
  onVisualize?: (type: string) => void;
}

export const EnhancedResultDisplay: React.FC<EnhancedResultDisplayProps> = ({
  result,
  error,
  loading,
  query,
  onExport,
  onCopy,
  onVisualize
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'insights' | 'chart'>('table');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // 虚拟化参数
  const ROW_HEIGHT = 40; // 每行高度
  const VISIBLE_ROWS = 50; // 可见行数

  // 优化的全屏切换函数
  const toggleFullscreen = React.useCallback((enable: boolean) => {
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
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning]);

  // 监听ESC键退出全屏
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && !isTransitioning) {
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
  React.useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);



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
          title: `${column} 统计`,
          description: `平均值: ${avg.toFixed(2)}, 最大值: ${max}, 最小值: ${min}`,
          value: avg.toFixed(2),
          confidence: 95,
          icon: '🔢'
        });

        // 异常值检测
        const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
        const outliers = values.filter(val => Math.abs(val - avg) > 2 * stdDev);
        
        if (outliers.length > 0) {
          insights.push({
            type: 'anomaly',
            title: `${column} 异常值`,
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

    return insights.slice(0, 6); // 限制洞察数量
  }, [result, query]);

  // 优化的排序数据 - 使用分页和延迟计算
  const sortedData = useMemo(() => {
    if (!result || !sortConfig) return result;

    const { columns, rows } = result;
    const columnIndex = columns.indexOf(sortConfig.key);
    if (columnIndex === -1) return result;

    // 对于大数据集，只排序前1000条用于显示
    const maxSortRows = Math.min(rows.length, 1000);
    const rowsToSort = rows.slice(0, maxSortRows);
    
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
     const remainingRows = rows.length > maxSortRows ? rows.slice(maxSortRows) : [];
     const finalRows = [...sortedRows, ...remainingRows];

     return { ...result, rows: finalRows };
  }, [result, sortConfig]);

  // 虚拟化计算
  const { visibleRows, startIndex, startOffset, endOffset } = React.useMemo(() => {
    if (!sortedData?.rows) {
      return { visibleRows: [], startIndex: 0, startOffset: 0, endOffset: 0 };
    }

    const totalRows = sortedData.rows.length;
    const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
    const endIndex = Math.min(startIndex + VISIBLE_ROWS, totalRows);
    
    const visibleRows = sortedData.rows.slice(startIndex, endIndex);
    const startOffset = startIndex * ROW_HEIGHT;
    const endOffset = (totalRows - endIndex) * ROW_HEIGHT;

    return { visibleRows, startIndex, startOffset, endOffset };
  }, [sortedData, scrollTop, ROW_HEIGHT, VISIBLE_ROWS]);

  // 防抖的滚动处理
  const handleScroll = React.useCallback(
    React.useMemo(() => {
      let timeoutId: number;
      return (e: React.UIEvent<HTMLDivElement>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          setScrollTop(e.currentTarget.scrollTop);
        }, 16); // 约60fps
      };
    }, []),
    []
  );

  // 处理排序
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

  // 获取洞察类型样式
  const getInsightStyle = (type: DataInsight['type']) => {
    switch (type) {
      case 'summary':
        return 'bg-info/10 border-info/20 text-info';
      case 'trend':
        return 'bg-success/10 border-success/20 text-success';
      case 'anomaly':
        return 'bg-warning/10 border-warning/20 text-warning';
      case 'recommendation':
        return 'bg-primary/10 border-primary/20 text-primary';
      default:
        return 'bg-base-200 border-base-300';
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
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
  }

  // 渲染错误状态
  if (error) {
    return (
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
  }

  // 渲染无结果状态
  if (!result || !result.rows || result.rows.length === 0) {
    return (
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
  }

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
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  {result.columns.map((column, index) => (
                    <th 
                      key={index} 
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort(column)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column}</span>
                        {sortConfig?.key === column && (
                          <span className="text-xs">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData?.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="max-w-xs truncate">
                        {cell === null || cell === undefined ? (
                          <span className="text-base-content/30 italic">null</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'insights' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${getInsightStyle(insight.type)}`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{insight.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{insight.title}</h4>
                      <p className="text-sm opacity-80 mb-2">{insight.description}</p>
                      {insight.value && (
                        <div className="text-lg font-semibold">{insight.value}</div>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs opacity-60">置信度:</span>
                        <div className="flex-1 bg-base-content/10 rounded-full h-1.5">
                          <div 
                            className="bg-current h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${insight.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs opacity-60">{insight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'chart' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="font-semibold text-lg mb-2">图表功能</h3>
            <p className="text-base-content/70 mb-4">选择合适的图表类型来可视化您的数据</p>
            <div className="flex justify-center space-x-2">
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => onVisualize?.('bar')}
              >
                📊 柱状图
              </button>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => onVisualize?.('line')}
              >
                📈 折线图
              </button>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => onVisualize?.('pie')}
              >
                🥧 饼图
              </button>
            </div>
          </div>
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
                    {result?.columns.map((column, index) => (
                      <th 
                        key={`header-${index}`} 
                        className="cursor-pointer hover:bg-base-300 font-medium transition-colors duration-150"
                        onClick={() => handleSort(column)}
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
};