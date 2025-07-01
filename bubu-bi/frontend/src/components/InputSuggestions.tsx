import React, { useState, useEffect, useRef } from 'react';

interface InputSuggestion {
  id: string;
  text: string;
  description?: string;
  type: 'template' | 'completion' | 'field' | 'table';
  icon: string;
}

interface InputSuggestionsProps {
  input: string;
  suggestions: InputSuggestion[];
  onSuggestionSelect: (suggestion: InputSuggestion) => void;
  onClose: () => void;
  visible: boolean;
  position?: { top: number; left: number };
}

// 预定义的查询模板
const QUERY_TEMPLATES: InputSuggestion[] = [
  {
    id: 'total_count',
    text: '统计总数量',
    description: '计算数据的总记录数',
    type: 'template',
    icon: '🔢'
  },
  {
    id: 'top_10',
    text: '显示前10名',
    description: '按某个字段排序显示前10条记录',
    type: 'template',
    icon: '🏆'
  },
  {
    id: 'average_value',
    text: '计算平均值',
    description: '计算数值字段的平均值',
    type: 'template',
    icon: '📊'
  },
  {
    id: 'group_by_category',
    text: '按分类统计',
    description: '按某个分类字段进行分组统计',
    type: 'template',
    icon: '📋'
  },
  {
    id: 'time_trend',
    text: '按时间趋势分析',
    description: '按时间维度分析数据变化',
    type: 'template',
    icon: '📈'
  },
  {
    id: 'max_min_value',
    text: '找出最大值和最小值',
    description: '查找数值字段的最大值和最小值',
    type: 'template',
    icon: '⚡'
  },
  {
    id: 'data_overview',
    text: '数据概览',
    description: '显示数据的基本统计信息',
    type: 'template',
    icon: '👀'
  },
  {
    id: 'duplicate_check',
    text: '检查重复数据',
    description: '查找重复的记录',
    type: 'template',
    icon: '🔍'
  }
];

// 常用的查询关键词
const QUERY_KEYWORDS = [
  { keyword: '统计', suggestions: ['统计总数', '统计平均值', '统计最大值', '统计最小值'] },
  { keyword: '分析', suggestions: ['趋势分析', '对比分析', '分布分析', '相关性分析'] },
  { keyword: '查找', suggestions: ['查找最大值', '查找最小值', '查找重复', '查找异常'] },
  { keyword: '显示', suggestions: ['显示前10名', '显示后10名', '显示全部', '显示概览'] },
  { keyword: '按', suggestions: ['按时间', '按分类', '按数量', '按金额'] },
  { keyword: '计算', suggestions: ['计算总和', '计算平均值', '计算百分比', '计算增长率'] }
];

export const InputSuggestions: React.FC<InputSuggestionsProps> = ({
  input,
  suggestions,
  onSuggestionSelect,
  onClose,
  visible,
  position
}) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState<InputSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 根据输入内容过滤建议
  useEffect(() => {
    if (!input.trim()) {
      setFilteredSuggestions(QUERY_TEMPLATES.slice(0, 6));
      return;
    }

    const inputLower = input.toLowerCase();
    const filtered: InputSuggestion[] = [];

    // 添加模板建议
    const templateMatches = QUERY_TEMPLATES.filter(template => 
      template.text.toLowerCase().includes(inputLower) ||
      template.description?.toLowerCase().includes(inputLower)
    );
    filtered.push(...templateMatches);

    // 添加关键词补全建议
    for (const { keyword, suggestions: keywordSuggestions } of QUERY_KEYWORDS) {
      if (inputLower.includes(keyword)) {
        const completions = keywordSuggestions.map((suggestion, index) => ({
          id: `completion_${keyword}_${index}`,
          text: suggestion,
          type: 'completion' as const,
          icon: '💡'
        }));
        filtered.push(...completions);
      }
    }

    // 添加外部传入的建议
    filtered.push(...suggestions);

    // 去重并限制数量
    const uniqueFiltered = filtered
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text)
      )
      .slice(0, 8);

    setFilteredSuggestions(uniqueFiltered);
    setSelectedIndex(0);
  }, [input, suggestions]);

  // 处理键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || filteredSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSuggestions[selectedIndex]) {
            onSuggestionSelect(filteredSuggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredSuggestions, selectedIndex, onSuggestionSelect, onClose]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible, onClose]);

  if (!visible || filteredSuggestions.length === 0) {
    return null;
  }

  const getTypeLabel = (type: InputSuggestion['type']) => {
    switch (type) {
      case 'template': return '模板';
      case 'completion': return '补全';
      case 'field': return '字段';
      case 'table': return '表名';
      default: return '';
    }
  };

  const getTypeColor = (type: InputSuggestion['type']) => {
    switch (type) {
      case 'template': return 'bg-info/10 text-info';
      case 'completion': return 'bg-success/10 text-success';
      case 'field': return 'bg-secondary/10 text-secondary';
      case 'table': return 'bg-warning/10 text-warning';
      default: return 'bg-base-300/50 text-base-content';
    }
  };

  return (
    <div 
      ref={containerRef}
      className="absolute z-50 w-full max-w-md bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
      style={position ? { top: position.top, left: position.left } : {}}
    >
      <div className="p-2">
        <div className="flex items-center space-x-2 mb-2 px-2">
          <span className="text-sm">💡</span>
          <span className="text-xs font-medium text-base-content/70">智能建议</span>
          <div className="flex-1"></div>
          <span className="text-xs text-base-content/50">↑↓ 选择 Enter 确认</span>
        </div>
        
        <div className="space-y-1">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionSelect(suggestion)}
              className={`w-full text-left p-2 rounded-md transition-colors ${
                index === selectedIndex 
                  ? 'bg-primary/10 border border-primary/20' 
                  : 'hover:bg-base-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-sm mt-0.5">{suggestion.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-base-content truncate">
                      {suggestion.text}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      getTypeColor(suggestion.type)
                    }`}>
                      {getTypeLabel(suggestion.type)}
                    </span>
                  </div>
                  {suggestion.description && (
                    <p className="text-xs text-base-content/60 mt-0.5 line-clamp-1">
                      {suggestion.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};