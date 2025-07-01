import React from 'react';
import { SmartSuggestion } from '../hooks/useSmartSuggestions';

interface SmartSuggestionsProps {
  suggestions: SmartSuggestion[];
  loading: boolean;
  onSuggestionClick: (suggestion: SmartSuggestion) => void;
  className?: string;
}

const CATEGORY_LABELS = {
  analysis: '📊 数据分析',
  statistics: '📈 统计汇总', 
  comparison: '⚖️ 对比分析',
  trend: '📉 趋势分析',
  custom: '🎯 自定义'
};

const CATEGORY_COLORS = {
  analysis: 'bg-info/10 border-info/20 text-info',
  statistics: 'bg-success/10 border-success/20 text-success',
  comparison: 'bg-secondary/10 border-secondary/20 text-secondary', 
  trend: 'bg-warning/10 border-warning/20 text-warning',
  custom: 'bg-base-300/50 border-base-300 text-base-content'
};

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  suggestions,
  loading,
  onSuggestionClick,
  className = ''
}) => {
  if (loading) {
    return (
      <div className={`bg-base-100 rounded-lg border border-base-300 p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-base-content">AI智能建议</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-base-300 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className={`bg-base-100 rounded-lg border border-base-300 p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-base-content">AI智能建议</h3>
        </div>
        <div className="text-center text-base-content/60 py-4">
          <div className="text-2xl mb-2">💡</div>
          <p className="text-sm">上传数据文件后，AI将为您推荐分析方案</p>
        </div>
      </div>
    );
  }

  // 按分类分组建议
  const groupedSuggestions = suggestions.reduce((groups, suggestion) => {
    const category = suggestion.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(suggestion);
    return groups;
  }, {} as Record<string, SmartSuggestion[]>);

  return (
    <div className={`bg-base-100 rounded-lg border border-base-300 p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">🤖</span>
        <h3 className="font-semibold text-base-content">AI智能建议</h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
          {suggestions.length} 个建议
        </span>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => (
          <div key={category}>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-medium text-base-content/70">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </span>
              <div className="flex-1 h-px bg-base-300"></div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {categorySuggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => onSuggestionClick(suggestion)}
                  className="text-left p-3 rounded-lg border border-base-300 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-lg group-hover:scale-110 transition-transform">
                      {suggestion.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-sm text-base-content group-hover:text-primary transition-colors">
                          {suggestion.title}
                        </h4>
                        <div className="flex items-center space-x-1">
                          <div className="w-1 h-1 bg-base-content/30 rounded-full"></div>
                          <span className="text-xs text-base-content/50">
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-base-content/70 line-clamp-2">
                        {suggestion.description}
                      </p>
                      <div className="mt-2">
                        <span className={`inline-block text-xs px-2 py-1 rounded-full border ${
                          CATEGORY_COLORS[suggestion.category]
                        }`}>
                          {suggestion.query}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 6 && (
        <div className="mt-4 pt-3 border-t border-base-300">
          <button className="text-xs text-primary hover:text-primary-focus transition-colors">
            查看更多建议 ({suggestions.length - 6})
          </button>
        </div>
      )}
    </div>
  );
};