import React, { useMemo, useState } from 'react';
import { TableData } from '../types/data';

interface DataInsight {
  type: 'summary' | 'trend' | 'anomaly' | 'quality' | 'recommendation' | 'correlation' | 'distribution';
  title: string;
  description: string;
  value?: string | number;
  confidence: number;
  icon: string;
  details?: string[];
  actionable?: boolean;
  severity?: 'low' | 'medium' | 'high';
}

interface AnalysisInsight {
  category: string;
  insights: DataInsight[];
  timestamp: number;
  dataSize: number;
}

interface EnhancedInsightsProps {
  data?: TableData;
  analysisInsights?: AnalysisInsight[];
  onInsightAction?: (insight: DataInsight, action: string) => void;
  maxInsights?: number;
  showCategories?: string[];
  simplified?: boolean; // 新增简化模式
}

// 生成深度数据洞察
const generateAdvancedInsights = (data: TableData): AnalysisInsight[] => {
  if (!data || !data.rows || data.rows.length === 0) return [];

  const insights: AnalysisInsight[] = [];
  const numericColumns: number[] = [];
  const textColumns: number[] = [];
  const dateColumns: number[] = [];

  // 分析列类型
  data.columns.forEach((col, index) => {
    const sampleValues = data.rows.slice(0, 10).map(row => row[index]).filter(val => val !== null && val !== undefined);
    
    if (sampleValues.length === 0) return;
    
    // 检测数值列
    const isNumeric = sampleValues.every(val => !isNaN(Number(val)));
    if (isNumeric) {
      numericColumns.push(index);
      return;
    }
    
    // 检测日期列
    const isDate = sampleValues.some(val => {
      if (typeof val === 'boolean') return false;
      const dateVal = new Date(val);
      return !isNaN(dateVal.getTime()) && val.toString().match(/\d{4}/);
    });
    if (isDate) {
      dateColumns.push(index);
      return;
    }
    
    textColumns.push(index);
  });

  // 1. 数据质量分析
  const qualityInsights: DataInsight[] = [];
  
  // 空值分析
  data.columns.forEach((col, index) => {
    const nullCount = data.rows.filter(row => row[index] === null || row[index] === undefined || row[index] === '').length;
    const nullPercentage = (nullCount / data.rows.length) * 100;
    
    if (nullPercentage > 10) {
      qualityInsights.push({
        type: 'quality',
        title: `${col} 列数据缺失`,
        description: `该列有 ${nullPercentage.toFixed(1)}% 的数据为空`,
        value: `${nullCount}/${data.rows.length}`,
        confidence: 95,
        icon: '⚠️',
        severity: nullPercentage > 50 ? 'high' : nullPercentage > 25 ? 'medium' : 'low',
        actionable: true,
        details: [
          `空值数量: ${nullCount}`,
          `总行数: ${data.rows.length}`,
          `建议: 考虑数据清洗或填充策略`
        ]
      });
    }
  });

  if (qualityInsights.length > 0) {
    insights.push({
      category: '数据质量',
      insights: qualityInsights,
      timestamp: Date.now(),
      dataSize: data.rows.length
    });
  }

  // 2. 数值分析
  if (numericColumns.length > 0) {
    const numericInsights: DataInsight[] = [];
    
    numericColumns.forEach(colIndex => {
      const colName = data.columns[colIndex];
      const values = data.rows.map(row => Number(row[colIndex])).filter(val => !isNaN(val));
      
      if (values.length === 0) return;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
      
      // 基础统计
      numericInsights.push({
        type: 'summary',
        title: `${colName} 统计摘要`,
        description: `平均值 ${avg.toFixed(2)}, 范围 ${min} - ${max}`,
        value: avg.toFixed(2),
        confidence: 100,
        icon: '📊',
        details: [
          `平均值: ${avg.toFixed(2)}`,
          `中位数: ${median.toFixed(2)}`,
          `最大值: ${max}`,
          `最小值: ${min}`,
          `总和: ${sum.toFixed(2)}`
        ]
      });
      
      // 异常值检测
      const q1 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.25)];
      const q3 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const outliers = values.filter(val => val < q1 - 1.5 * iqr || val > q3 + 1.5 * iqr);
      
      if (outliers.length > 0) {
        numericInsights.push({
          type: 'anomaly',
          title: `${colName} 异常值检测`,
          description: `发现 ${outliers.length} 个潜在异常值`,
          value: outliers.length,
          confidence: 85,
          icon: '🔍',
          severity: outliers.length > values.length * 0.1 ? 'high' : 'medium',
          actionable: true,
          details: [
            `异常值数量: ${outliers.length}`,
            `异常值占比: ${((outliers.length / values.length) * 100).toFixed(1)}%`,
            `Q1: ${q1.toFixed(2)}`,
            `Q3: ${q3.toFixed(2)}`,
            `IQR: ${iqr.toFixed(2)}`
          ]
        });
      }
    });
    
    if (numericInsights.length > 0) {
      insights.push({
        category: '数值分析',
        insights: numericInsights,
        timestamp: Date.now(),
        dataSize: data.rows.length
      });
    }
  }

  // 3. 分布分析
  if (textColumns.length > 0) {
    const distributionInsights: DataInsight[] = [];
    
    textColumns.forEach(colIndex => {
      const colName = data.columns[colIndex];
      const values = data.rows.map(row => row[colIndex]).filter(val => val !== null && val !== undefined);
      const uniqueValues = [...new Set(values)];
      const uniqueRatio = uniqueValues.length / values.length;
      
      distributionInsights.push({
        type: 'distribution',
        title: `${colName} 数据分布`,
        description: `${uniqueValues.length} 个唯一值，重复率 ${((1 - uniqueRatio) * 100).toFixed(1)}%`,
        value: uniqueValues.length,
        confidence: 90,
        icon: '📈',
        details: [
          `唯一值数量: ${uniqueValues.length}`,
          `总值数量: ${values.length}`,
          `唯一性比率: ${(uniqueRatio * 100).toFixed(1)}%`,
          `重复率: ${((1 - uniqueRatio) * 100).toFixed(1)}%`
        ]
      });
      
      // 如果重复率很高，可能是分类数据
      if (uniqueRatio < 0.1 && uniqueValues.length < 20) {
        const valueCounts = values.reduce((acc, val) => {
          if (val !== null && val !== undefined) {
            const key = String(val);
            acc[key] = (acc[key] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        const topValues = Object.entries(valueCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 5);
        
        distributionInsights.push({
          type: 'trend',
          title: `${colName} 热门值`,
          description: `最常见的值是 "${topValues[0][0]}" (${topValues[0][1]} 次)`,
          value: topValues[0][0],
          confidence: 95,
          icon: '🔥',
          details: topValues.map(([val, count]) => `${val}: ${count} 次 (${(((count as number) / values.length) * 100).toFixed(1)}%)`)
        });
      }
    });
    
    if (distributionInsights.length > 0) {
      insights.push({
        category: '分布分析',
        insights: distributionInsights,
        timestamp: Date.now(),
        dataSize: data.rows.length
      });
    }
  }

  // 4. 相关性分析（如果有多个数值列）
  if (numericColumns.length > 1) {
    const correlationInsights: DataInsight[] = [];
    
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        const col1Name = data.columns[col1];
        const col2Name = data.columns[col2];
        
        const values1 = data.rows.map(row => Number(row[col1])).filter(val => !isNaN(val));
        const values2 = data.rows.map(row => Number(row[col2])).filter(val => !isNaN(val));
        
        if (values1.length !== values2.length) continue;
        
        // 计算皮尔逊相关系数
        const n = values1.length;
        const sum1 = values1.reduce((a, b) => a + b, 0);
        const sum2 = values2.reduce((a, b) => a + b, 0);
        const sum1Sq = values1.reduce((a, b) => a + b * b, 0);
        const sum2Sq = values2.reduce((a, b) => a + b * b, 0);
        const pSum = values1.reduce((a, b, idx) => a + b * values2[idx], 0);
        
        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
        const correlation = den === 0 ? 0 : num / den;
        
        if (Math.abs(correlation) > 0.5) {
          correlationInsights.push({
            type: 'correlation',
            title: `${col1Name} 与 ${col2Name} 相关性`,
            description: `${Math.abs(correlation) > 0.7 ? '强' : '中等'}${correlation > 0 ? '正' : '负'}相关`,
            value: correlation.toFixed(3),
            confidence: Math.min(95, Math.abs(correlation) * 100),
            icon: correlation > 0 ? '📈' : '📉',
            severity: Math.abs(correlation) > 0.8 ? 'high' : 'medium',
            details: [
              `相关系数: ${correlation.toFixed(3)}`,
              `相关强度: ${Math.abs(correlation) > 0.8 ? '强' : Math.abs(correlation) > 0.5 ? '中等' : '弱'}`,
              `方向: ${correlation > 0 ? '正相关' : '负相关'}`,
              `样本数量: ${n}`
            ]
          });
        }
      }
    }
    
    if (correlationInsights.length > 0) {
      insights.push({
        category: '相关性分析',
        insights: correlationInsights,
        timestamp: Date.now(),
        dataSize: data.rows.length
      });
    }
  }

  // 5. 建议
  const recommendations: DataInsight[] = [];
  
  if (data.rows.length > 1000) {
    recommendations.push({
      type: 'recommendation',
      title: '大数据集优化建议',
      description: '数据量较大，建议使用分页或筛选来提升性能',
      confidence: 90,
      icon: '💡',
      actionable: true,
      details: [
        '当前数据量: ' + data.rows.length + ' 行',
        '建议: 使用分页显示',
        '建议: 添加筛选条件',
        '建议: 考虑数据聚合'
      ]
    });
  }
  
  if (numericColumns.length > 0 && textColumns.length > 0) {
    recommendations.push({
      type: 'recommendation',
      title: '可视化建议',
      description: '数据包含数值和分类字段，适合创建多种图表',
      confidence: 85,
      icon: '📊',
      actionable: true,
      details: [
        '建议图表: 柱状图（分类对比）',
        '建议图表: 折线图（趋势分析）',
        '建议图表: 散点图（相关性）',
        '建议: 按分类字段分组分析'
      ]
    });
  }
  
  if (recommendations.length > 0) {
    insights.push({
      category: '优化建议',
      insights: recommendations,
      timestamp: Date.now(),
      dataSize: data.rows.length
    });
  }

  return insights;
};

// 获取洞察样式
const getInsightStyle = (type: string, severity?: string) => {
  const baseStyle = 'border-l-4 ';
  
  switch (type) {
    case 'summary':
      return baseStyle + 'border-blue-500 bg-blue-50';
    case 'trend':
      return baseStyle + 'border-green-500 bg-green-50';
    case 'anomaly':
      const anomalyColor = severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow';
      return baseStyle + `border-${anomalyColor}-500 bg-${anomalyColor}-50`;
    case 'quality':
      const qualityColor = severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow';
      return baseStyle + `border-${qualityColor}-500 bg-${qualityColor}-50`;
    case 'recommendation':
      return baseStyle + 'border-purple-500 bg-purple-50';
    case 'correlation':
      return baseStyle + 'border-indigo-500 bg-indigo-50';
    case 'distribution':
      return baseStyle + 'border-teal-500 bg-teal-50';
    default:
      return baseStyle + 'border-gray-500 bg-gray-50';
  }
};

export const EnhancedInsights: React.FC<EnhancedInsightsProps> = ({
  data,
  analysisInsights,
  onInsightAction,
  simplified = false
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  
  const allInsights = useMemo(() => {
    if (!data) return analysisInsights || [];
    const generated = generateAdvancedInsights(data);
    return analysisInsights ? [...analysisInsights, ...generated] : generated;
  }, [data, analysisInsights]);
  
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(allInsights.map(insight => insight.category))];
    return cats;
  }, [allInsights]);
  
  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return allInsights;
    return allInsights.filter(insight => insight.category === selectedCategory);
  }, [allInsights, selectedCategory]);
  
  const toggleInsightDetails = (insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  };
  
  if (allInsights.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="font-semibold text-lg mb-2">正在分析数据...</h3>
        <p className="text-base-content/70">AI 正在深度分析您的数据，请稍候</p>
      </div>
    );
  }
  
  // 简化模式：只显示关键洞察摘要
  if (simplified) {
    const keyInsights = allInsights
      .flatMap(group => group.insights)
      .filter(insight => insight.severity === 'high' || insight.actionable)
      .slice(0, 3);
    
    return (
      <div className="bg-base-100 p-4 rounded-lg border">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold">关键洞察</h3>
          <span className="badge badge-primary badge-sm">{keyInsights.length}</span>
        </div>
        <div className="space-y-2">
          {keyInsights.map((insight, index) => (
            <div key={index} className="flex items-start space-x-2 text-sm">
              <span className="text-base">{insight.icon}</span>
              <div>
                <span className="font-medium">{insight.title}:</span>
                <span className="ml-1 text-base-content/70">{insight.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category}
            className={`btn btn-sm ${
              selectedCategory === category ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? '全部' : category}
            {category !== 'all' && (
              <span className="ml-1 badge badge-sm">
                {allInsights.filter(i => i.category === category).reduce((sum, i) => sum + i.insights.length, 0)}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* 洞察列表 */}
      <div className="space-y-6">
        {filteredInsights.map((insightGroup, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-lg">{insightGroup.category}</h3>
              <span className="badge badge-outline">{insightGroup.insights.length} 项</span>
              <span className="text-xs text-base-content/50">
                {new Date(insightGroup.timestamp).toLocaleString()}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insightGroup.insights.map((insight, index) => {
                const insightId = `${groupIndex}-${index}`;
                const isExpanded = expandedInsights.has(insightId);
                
                return (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg ${getInsightStyle(insight.type, insight.severity)} cursor-pointer transition-all hover:shadow-md`}
                    onClick={() => toggleInsightDetails(insightId)}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{insight.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">{insight.title}</h4>
                          {insight.severity && (
                            <span className={`badge badge-sm ${
                              insight.severity === 'high' ? 'badge-error' :
                              insight.severity === 'medium' ? 'badge-warning' : 'badge-info'
                            }`}>
                              {insight.severity === 'high' ? '高' : insight.severity === 'medium' ? '中' : '低'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm opacity-80 mb-2">{insight.description}</p>
                        {insight.value && (
                          <div className="text-lg font-semibold mb-2">{insight.value}</div>
                        )}
                        
                        {/* 置信度 */}
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs opacity-60">置信度:</span>
                          <div className="flex-1 bg-base-content/10 rounded-full h-1.5 max-w-24">
                            <div 
                              className="bg-current h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${insight.confidence}%` }}
                            ></div>
                          </div>
                          <span className="text-xs opacity-60">{insight.confidence}%</span>
                        </div>
                        
                        {/* 详细信息 */}
                        {isExpanded && insight.details && (
                          <div className="mt-3 p-3 bg-white/50 rounded border">
                            <h5 className="font-medium text-sm mb-2">详细信息:</h5>
                            <ul className="text-xs space-y-1">
                              {insight.details.map((detail, i) => (
                                <li key={i} className="flex items-start space-x-2">
                                  <span className="text-base-content/40">•</span>
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* 操作按钮 */}
                        {insight.actionable && (
                          <div className="mt-3 flex space-x-2">
                            <button 
                              className="btn btn-xs btn-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInsightAction?.(insight, 'investigate');
                              }}
                            >
                              🔍 深入分析
                            </button>
                            <button 
                              className="btn btn-xs btn-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInsightAction?.(insight, 'export');
                              }}
                            >
                              📤 导出报告
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* 总结 */}
      <div className="bg-base-200 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold">分析总结</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">{allInsights.reduce((sum, i) => sum + i.insights.length, 0)}</div>
            <div className="text-xs text-base-content/60">总洞察数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">
              {allInsights.reduce((sum, i) => sum + i.insights.filter(insight => insight.actionable).length, 0)}
            </div>
            <div className="text-xs text-base-content/60">可操作项</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-error">
              {allInsights.reduce((sum, i) => sum + i.insights.filter(insight => insight.severity === 'high').length, 0)}
            </div>
            <div className="text-xs text-base-content/60">高优先级</div>
          </div>
          <div>            <div className="text-2xl font-bold text-success">{data?.rows.length || 0}</div>            <div className="text-xs text-base-content/60">数据行数</div>          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInsights;