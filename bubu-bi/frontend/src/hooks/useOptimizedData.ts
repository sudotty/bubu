import { useMemo, useCallback, useState } from 'react';
import type { TableData, ChartConfig, DataInsight } from '../types/data';

/**
 * 优化的数据处理hook
 */
export const useOptimizedData = (rawData: TableData) => {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const [filterConfig, setFilterConfig] = useState<{
    column: string;
    value: string;
  } | null>(null);

  // 缓存处理后的数据
  const processedData = useMemo(() => {
    if (!rawData?.rows) return rawData;

    let result = [...rawData.rows];

    // 应用过滤
    if (filterConfig) {
      const columnIndex = rawData.columns.indexOf(filterConfig.column);
      if (columnIndex !== -1) {
        result = result.filter(row => {
          const cellValue = row[columnIndex];
          return String(cellValue).toLowerCase().includes(filterConfig.value.toLowerCase());
        });
      }
    }

    // 应用排序
    if (sortConfig) {
      const columnIndex = rawData.columns.indexOf(sortConfig.key);
      if (columnIndex !== -1) {
        result.sort((a, b) => {
          const aVal = a[columnIndex];
          const bVal = b[columnIndex];
          
          // 数值比较
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }
          
          // 字符串比较
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          
          if (sortConfig.direction === 'asc') {
            return aStr.localeCompare(bStr);
          } else {
            return bStr.localeCompare(aStr);
          }
        });
      }
    }

    return {
      ...rawData,
      rows: result
    };
  }, [rawData, sortConfig, filterConfig]);

  // 缓存排序处理函数
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.key === column) {
        // 切换排序方向
        return {
          key: column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // 新列排序
        return {
          key: column,
          direction: 'asc'
        };
      }
    });
  }, []);

  // 缓存过滤处理函数
  const handleFilter = useCallback((column: string, value: string) => {
    setFilterConfig(value ? { column, value } : null);
  }, []);

  // 缓存重置函数
  const resetFilters = useCallback(() => {
    setSortConfig(null);
    setFilterConfig(null);
  }, []);

  return {
    data: processedData,
    sortConfig,
    filterConfig,
    handleSort,
    handleFilter,
    resetFilters
  };
};

/**
 * 优化的图表配置hook
 */
export const useOptimizedChart = (data: TableData, initialChartType: string = 'bar') => {
  const [chartType, setChartType] = useState(initialChartType);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // 缓存图表配置
  const chartConfig = useMemo((): ChartConfig => {
    if (!data?.columns || !data?.rows) {
      return {
        type: chartType as any,
        options: {}
      };
    }

    const columnsToUse = selectedColumns.length > 0 ? selectedColumns : data.columns.slice(0, 2);
    
    return {
      type: chartType as any,
      title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
      xAxis: columnsToUse[0],
      yAxis: columnsToUse.slice(1),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
          }
        }
      }
    };
  }, [data, chartType, selectedColumns]);

  // 缓存图表类型变更函数
  const handleChartTypeChange = useCallback((newType: string) => {
    setChartType(newType);
  }, []);

  // 缓存列选择函数
  const handleColumnSelection = useCallback((columns: string[]) => {
    setSelectedColumns(columns);
  }, []);

  return {
    chartConfig,
    chartType,
    selectedColumns,
    handleChartTypeChange,
    handleColumnSelection
  };
};

/**
 * 优化的洞察数据hook
 */
export const useOptimizedInsights = (data: TableData) => {
  // 缓存洞察计算
  const insights = useMemo((): DataInsight[] => {
    if (!data?.rows || !data?.columns) return [];

    const insights: DataInsight[] = [];
    const numericColumns: string[] = [];
    
    // 识别数值列
    data.columns.forEach((header: string, index: number) => {
      const firstValue = data.rows[0]?.[index];
      if (typeof firstValue === 'number') {
        numericColumns.push(header);
      }
    });

    // 生成基本统计洞察
    numericColumns.forEach(column => {
      const columnIndex = data.columns.indexOf(column);
      const values = data.rows
        .map(row => row[columnIndex])
        .filter(val => typeof val === 'number') as number[];
      
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        insights.push({
          id: `stat-${column}-${Date.now()}`,
          type: 'summary',
          title: `${column} 统计信息`,
          description: `平均值: ${avg.toFixed(2)}, 最大值: ${max}, 最小值: ${min}`,
          confidence: 0.9,
          severity: 'low',
          timestamp: new Date()
        });
      }
    });

    // 数据质量洞察
    const totalRows = data.rows.length;
    const emptyCount = data.rows.reduce((count, row) => {
      return count + row.filter(cell => cell === null || cell === undefined || cell === '').length;
    }, 0);
    
    if (emptyCount > 0) {
      insights.push({
        id: `quality-${Date.now()}`,
        type: 'recommendation',
        title: '数据质量提醒',
        description: `发现 ${emptyCount} 个空值，占总数据的 ${((emptyCount / (totalRows * data.columns.length)) * 100).toFixed(1)}%`,
        confidence: 1.0,
        severity: 'medium',
        timestamp: new Date()
      });
    }

    return insights;
  }, [data]);

  return { insights };
};