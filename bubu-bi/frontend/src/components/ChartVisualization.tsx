import React, { useMemo, useCallback, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import type { ChartConfig, TableData } from '../types/data';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartVisualizationProps {
  config: ChartConfig;
  data?: TableData;
  width?: number;
  height?: number;
  interactive?: boolean;
  onDataPointClick?: (dataPoint: any, index: number) => void;
  onChartTypeChange?: (type: 'bar' | 'line' | 'pie' | 'scatter') => void;
}

// 生成随机颜色
const generateColors = (count: number) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // 黄金角度分布
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

// 处理数据为图表格式
const processDataForChart = (data: TableData | undefined, chartType: 'bar' | 'line' | 'pie' | 'scatter') => {
  if (!data || !data.rows || data.rows.length === 0) {
    return null;
  }

  // 找到数值列和标签列
  const numericColumns: number[] = [];
  const labelColumn = 0; // 默认第一列作为标签

  // 检测数值列
  for (let i = 1; i < data.columns.length; i++) {
    const sampleValues = data.rows.slice(0, 5).map(row => row[i]);
    const isNumeric = sampleValues.every(val => 
      val !== null && val !== undefined && !isNaN(Number(val))
    );
    if (isNumeric) {
      numericColumns.push(i);
    }
  }

  if (numericColumns.length === 0) {
    return null;
  }

  const labels = data.rows.map(row => String(row[labelColumn] || ''));
  
  if (chartType === 'pie') {
    // 饼图只使用第一个数值列
    const values = data.rows.map(row => Number(row[numericColumns[0]]) || 0);
    const colors = generateColors(values.length);
    
    return {
      labels,
      datasets: [{
        label: data.columns[numericColumns[0]],
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('60%', '40%')),
        borderWidth: 2,
      }]
    };
  } else {
    // 柱状图和折线图可以显示多个数值列
    const colors = generateColors(numericColumns.length);
    
    return {
      labels,
      datasets: numericColumns.map((colIndex, i) => ({
        label: data.columns[colIndex],
        data: data.rows.map(row => Number(row[colIndex]) || 0),
        backgroundColor: chartType === 'bar' ? colors[i] : 'transparent',
        borderColor: colors[i],
        borderWidth: 2,
        fill: chartType === 'line' ? false : true,
        tension: chartType === 'line' ? 0.4 : 0,
      }))
    };
  }
};

// 图表配置选项
const getChartOptions = (chartType: 'bar' | 'line' | 'pie' | 'scatter'): ChartOptions<any> => {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const,
    }
  };

  if (chartType === 'pie') {
    return {
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: {
          ...baseOptions.plugins.legend,
          position: 'right' as const,
        }
      }
    };
  }

  return {
    ...baseOptions,
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxRotation: 45,
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        beginAtZero: true,
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };
};

export const ChartVisualization: React.FC<ChartVisualizationProps> = ({
  config,
  data,
  width = 600,
  height = 400,
  interactive = true,
  onDataPointClick,
  onChartTypeChange
}) => {
  const chartData = useMemo(() => processDataForChart(data, config.type), [data, config.type]);
  const chartOptions = useMemo(() => getChartOptions(config.type), [config.type]);

  if (!chartData) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="font-semibold text-lg mb-2">无法生成图表</h3>
        <p className="text-base-content/70 mb-4">
          数据中没有找到合适的数值列用于图表展示
        </p>
        <div className="text-sm text-base-content/50">
          提示：确保数据包含数值类型的列
        </div>
      </div>
    );
  }

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'line':
        return <Line data={chartData} options={chartOptions} />;
      case 'pie':
        return <Pie data={chartData} options={chartOptions} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* 图表类型选择器 */}
      <div className="flex justify-center space-x-2">
        <button 
          className={`btn btn-sm ${
            config.type === 'bar' ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => onChartTypeChange?.('bar')}
        >
          📊 柱状图
        </button>
        <button 
          className={`btn btn-sm ${
            config.type === 'line' ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => onChartTypeChange?.('line')}
        >
          📈 折线图
        </button>
        <button 
          className={`btn btn-sm ${
            config.type === 'pie' ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => onChartTypeChange?.('pie')}
        >
          🥧 饼图
        </button>
      </div>

      {/* 图表容器 */}
      <div className="bg-white p-4 rounded-lg border" style={{ width, height }}>
        {renderChart()}
      </div>

      {/* 图表信息 */}
      <div className="text-center text-sm text-base-content/60">
        <div className="flex justify-center items-center space-x-4">
          <span>📊 数据点: {data?.rows.length || 0}</span>
          <span>📋 列数: {data?.columns.length || 0}</span>
          <span>📈 图表类型: {config.type === 'bar' ? '柱状图' : config.type === 'line' ? '折线图' : '饼图'}</span>
        </div>
      </div>
    </div>
  );
};

export default ChartVisualization;