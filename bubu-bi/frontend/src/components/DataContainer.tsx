import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import type { TableData, ChartConfig, DataInsight } from '../types/data';
import { useOptimizedData, useOptimizedChart, useOptimizedInsights } from '../hooks/useOptimizedData';

// 数据容器的基础props
interface DataContainerProps {
  data: TableData;
  children: (containerData: DataContainerRenderProps) => ReactNode;
  enableOptimization?: boolean;
  enableInsights?: boolean;
  enableChart?: boolean;
  initialChartType?: string;
  className?: string;
}

// 传递给子组件的数据
export interface DataContainerRenderProps {
  // 优化后的数据
  optimizedData: TableData;
  
  // 数据操作函数
  handleSort: (column: string) => void;
  handleFilter: (column: string, value: string) => void;
  resetFilters: () => void;
  
  // 排序和过滤状态
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  filterConfig: { column: string; value: string } | null;
  
  // 图表相关
  chartConfig?: ChartConfig;
  chartType?: string;
  selectedColumns?: string[];
  handleChartTypeChange?: (type: string) => void;
  handleColumnSelection?: (columns: string[]) => void;
  
  // 洞察数据
  insights?: DataInsight[];
  
  // 原始数据
  rawData: TableData;
}

/**
 * 数据容器组件 - 提供数据处理、优化和状态管理的统一容器
 * 使用render props模式，让子组件专注于UI渲染
 */
export const DataContainer: React.FC<DataContainerProps> = ({
  data,
  children,
  enableOptimization = true,
  enableInsights = true,
  enableChart = true,
  initialChartType = 'bar',
  className = ''
}) => {
  // 数据优化hooks
  const dataHooks = useOptimizedData(enableOptimization ? data : data);
  const chartHooks = useOptimizedChart(enableChart ? data : data, initialChartType);
  const insightHooks = useOptimizedInsights(enableInsights ? data : data);

  // 构建传递给子组件的数据
  const containerData: DataContainerRenderProps = {
    // 基础数据
    rawData: data,
    optimizedData: enableOptimization ? dataHooks.data : data,
    
    // 数据操作
    handleSort: dataHooks.handleSort,
    handleFilter: dataHooks.handleFilter,
    resetFilters: dataHooks.resetFilters,
    
    // 状态
    sortConfig: dataHooks.sortConfig,
    filterConfig: dataHooks.filterConfig,
    
    // 图表相关（仅在启用时提供）
    ...(enableChart && {
      chartConfig: chartHooks.chartConfig,
      chartType: chartHooks.chartType,
      selectedColumns: chartHooks.selectedColumns,
      handleChartTypeChange: chartHooks.handleChartTypeChange,
      handleColumnSelection: chartHooks.handleColumnSelection
    }),
    
    // 洞察数据（仅在启用时提供）
    ...(enableInsights && {
      insights: insightHooks.insights
    })
  };

  return (
    <ErrorBoundary>
      <div className={`data-container ${className}`}>
        {children(containerData)}
      </div>
    </ErrorBoundary>
  );
};

/**
 * 简化的数据表格容器 - 专门用于表格显示
 */
interface DataTableContainerProps {
  data: TableData;
  children: (props: {
    data: TableData;
    onSort: (column: string) => void;
    onFilter: (column: string, value: string) => void;
    onReset: () => void;
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    filterConfig: { column: string; value: string } | null;
  }) => ReactNode;
  className?: string;
}

export const DataTableContainer: React.FC<DataTableContainerProps> = ({
  data,
  children,
  className = ''
}) => {
  return (
    <DataContainer
      data={data}
      enableChart={false}
      enableInsights={false}
      className={className}
    >
      {({ optimizedData, handleSort, handleFilter, resetFilters, sortConfig, filterConfig }) =>
        children({
          data: optimizedData,
          onSort: handleSort,
          onFilter: handleFilter,
          onReset: resetFilters,
          sortConfig,
          filterConfig
        })
      }
    </DataContainer>
  );
};

/**
 * 简化的图表容器 - 专门用于图表显示
 */
interface DataChartContainerProps {
  data: TableData;
  initialChartType?: string;
  children: (props: {
    chartConfig: ChartConfig;
    chartType: string;
    selectedColumns: string[];
    onChartTypeChange: (type: string) => void;
    onColumnSelection: (columns: string[]) => void;
  }) => ReactNode;
  className?: string;
}

export const DataChartContainer: React.FC<DataChartContainerProps> = ({
  data,
  initialChartType = 'bar',
  children,
  className = ''
}) => {
  return (
    <DataContainer
      data={data}
      enableOptimization={false}
      enableInsights={false}
      initialChartType={initialChartType}
      className={className}
    >
      {({ chartConfig, chartType, selectedColumns, handleChartTypeChange, handleColumnSelection }) =>
        children({
          chartConfig: chartConfig!,
          chartType: chartType!,
          selectedColumns: selectedColumns!,
          onChartTypeChange: handleChartTypeChange!,
          onColumnSelection: handleColumnSelection!
        })
      }
    </DataContainer>
  );
};

/**
 * 简化的洞察容器 - 专门用于洞察显示
 */
interface DataInsightContainerProps {
  data: TableData;
  children: (props: {
    insights: DataInsight[];
  }) => ReactNode;
  className?: string;
}

export const DataInsightContainer: React.FC<DataInsightContainerProps> = ({
  data,
  children,
  className = ''
}) => {
  return (
    <DataContainer
      data={data}
      enableOptimization={false}
      enableChart={false}
      className={className}
    >
      {({ insights }) =>
        children({
          insights: insights!
        })
      }
    </DataContainer>
  );
};