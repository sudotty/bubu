import { useState, useEffect, useCallback } from 'react';
import { GetTableList, GetTableSchema } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

type QueryResult = main.QueryResult;

// 智能建议类型
export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  query: string;
  category: 'analysis' | 'statistics' | 'comparison' | 'trend' | 'custom';
  icon: string;
  confidence: number;
}

// 分析模板
const ANALYSIS_TEMPLATES = {
  sales: [
    {
      id: 'sales_total',
      title: '销售总额统计',
      description: '计算总销售额和平均销售额',
      query: '统计总销售额和平均销售额',
      category: 'statistics' as const,
      icon: '💰',
      confidence: 0.9
    },
    {
      id: 'sales_ranking',
      title: '销售排行榜',
      description: '按销售额排序，查看前10名',
      query: '按销售额排序显示前10名',
      category: 'analysis' as const,
      icon: '🏆',
      confidence: 0.85
    },
    {
      id: 'sales_trend',
      title: '销售趋势分析',
      description: '按时间分析销售趋势',
      query: '按月份分析销售趋势',
      category: 'trend' as const,
      icon: '📈',
      confidence: 0.8
    }
  ],
  user: [
    {
      id: 'user_count',
      title: '用户数量统计',
      description: '统计总用户数和活跃用户数',
      query: '统计用户总数',
      category: 'statistics' as const,
      icon: '👥',
      confidence: 0.9
    },
    {
      id: 'user_activity',
      title: '用户活跃度分析',
      description: '分析用户活跃度分布',
      query: '分析用户活跃度',
      category: 'analysis' as const,
      icon: '📊',
      confidence: 0.85
    }
  ],
  product: [
    {
      id: 'product_popular',
      title: '热门产品分析',
      description: '找出最受欢迎的产品',
      query: '找出最热门的产品',
      category: 'analysis' as const,
      icon: '🔥',
      confidence: 0.85
    },
    {
      id: 'product_category',
      title: '产品分类统计',
      description: '按分类统计产品数量',
      query: '按分类统计产品数量',
      category: 'statistics' as const,
      icon: '📦',
      confidence: 0.8
    }
  ],
  general: [
    {
      id: 'data_overview',
      title: '数据概览',
      description: '查看数据的基本统计信息',
      query: '显示数据概览和基本统计',
      category: 'statistics' as const,
      icon: '📋',
      confidence: 0.9
    },
    {
      id: 'data_quality',
      title: '数据质量检查',
      description: '检查数据完整性和异常值',
      query: '检查数据质量和异常值',
      category: 'analysis' as const,
      icon: '🔍',
      confidence: 0.8
    }
  ]
};

// 常用查询模式
const COMMON_PATTERNS = [
  {
    pattern: /销售|营收|收入|金额/,
    templates: ANALYSIS_TEMPLATES.sales
  },
  {
    pattern: /用户|客户|会员/,
    templates: ANALYSIS_TEMPLATES.user
  },
  {
    pattern: /产品|商品|物品/,
    templates: ANALYSIS_TEMPLATES.product
  }
];

export const useSmartSuggestions = () => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableInfo, setTableInfo] = useState<{[key: string]: QueryResult}>({});

  // 加载表信息
  useEffect(() => {
    const loadTableInfo = async () => {
      try {
        const tables = await GetTableList();
        const info: {[key: string]: QueryResult} = {};
        
        for (const table of tables) {
          try {
            const schema = await GetTableSchema(table);
            info[table] = schema || { columns: [], rows: [], total: 0 };
          } catch (error) {
            console.error(`获取表 ${table} 结构失败:`, error);
            info[table] = { columns: [], rows: [], total: 0 };
          }
        }
        
        setTableInfo(info);
      } catch (error) {
        console.error('加载表信息失败:', error);
      }
    };

    loadTableInfo();
  }, []);

  // 根据表结构生成智能建议
  const generateSuggestions = useCallback(async () => {
    setLoading(true);
    
    try {
      const newSuggestions: SmartSuggestion[] = [];
      
      // 分析表名和字段，生成相关建议
      Object.keys(tableInfo).forEach(tableName => {
        const schema = tableInfo[tableName];
        const columns = schema.columns || [];
        const tableNameLower = tableName.toLowerCase();
        
        // 根据表名匹配模板
        for (const pattern of COMMON_PATTERNS) {
          if (pattern.pattern.test(tableNameLower)) {
            pattern.templates.forEach(template => {
              newSuggestions.push({
                ...template,
                id: `${tableName}_${template.id}`,
                query: template.query.replace(/表名/g, tableName)
              });
            });
            break;
          }
        }
        
        // 根据字段生成建议
        if (columns && columns.length > 0) {
          const columnNames = columns.map((col: any) => col.name?.toLowerCase() || '').join(' ');
          
          // 检查是否有时间字段
          if (/date|time|created|updated/.test(columnNames)) {
            newSuggestions.push({
              id: `${tableName}_time_analysis`,
              title: `${tableName} 时间趋势分析`,
              description: '按时间维度分析数据变化趋势',
              query: `分析 ${tableName} 的时间趋势`,
              category: 'trend',
              icon: '⏰',
              confidence: 0.8
            });
          }
          
          // 检查是否有数值字段
          const numericColumns = columns.filter((col: any) => 
            col.type && /int|float|decimal|number|numeric/.test(col.type.toLowerCase())
          );
          
          if (numericColumns.length > 0) {
            newSuggestions.push({
              id: `${tableName}_numeric_stats`,
              title: `${tableName} 数值统计`,
              description: '计算数值字段的统计信息',
              query: `统计 ${tableName} 的数值字段`,
              category: 'statistics',
              icon: '🔢',
              confidence: 0.85
            });
          }
        }
      });
      
      // 添加通用建议
      newSuggestions.push(...ANALYSIS_TEMPLATES.general);
      
      // 去重并按置信度排序
      const uniqueSuggestions = newSuggestions
        .filter((suggestion, index, self) => 
          index === self.findIndex(s => s.id === suggestion.id)
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8); // 限制数量
      
      setSuggestions(uniqueSuggestions);
    } catch (error) {
      console.error('生成智能建议失败:', error);
    } finally {
      setLoading(false);
    }
  }, [tableInfo]);

  // 当表信息变化时重新生成建议
  useEffect(() => {
    if (Object.keys(tableInfo).length > 0) {
      generateSuggestions();
    }
  }, [tableInfo, generateSuggestions]);

  // 根据输入内容获取相关建议
  const getInputSuggestions = useCallback((input: string) => {
    if (!input.trim()) return suggestions;
    
    const inputLower = input.toLowerCase();
    return suggestions.filter(suggestion => 
      suggestion.title.toLowerCase().includes(inputLower) ||
      suggestion.description.toLowerCase().includes(inputLower) ||
      suggestion.query.toLowerCase().includes(inputLower)
    );
  }, [suggestions]);

  // 获取分类建议
  const getSuggestionsByCategory = useCallback((category: SmartSuggestion['category']) => {
    return suggestions.filter(suggestion => suggestion.category === category);
  }, [suggestions]);

  return {
    suggestions,
    loading,
    tableInfo,
    generateSuggestions,
    getInputSuggestions,
    getSuggestionsByCategory
  };
};