import React, { useRef, useEffect, useCallback } from 'react';
import { DAISY_COMPONENTS, UI_CONSTANTS } from '../constants/ui';
import { isEnterPressed } from '../utils/keyboard';
import { useSmartInput } from '../store';
import type { InputMode } from '../store/slices/smartInputSlice';

// 建议项类型
export interface Suggestion {
  id: string;
  text: string;
  type: 'template' | 'history' | 'completion';
  category?: string;
  description?: string;
}

// 历史记录类型
export interface HistoryItem {
  id: string;
  query: string;
  mode: InputMode;
  timestamp: number;
  success?: boolean;
}

// 模板类型
export interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  mode: InputMode;
  variables?: string[];
}

export interface SmartInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string, mode: InputMode) => void;
  mode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  loading?: boolean;
  placeholder?: string;
  suggestions?: Suggestion[];
  history?: HistoryItem[];
  templates?: Template[];
  showModeSwitch?: boolean;
  showSuggestions?: boolean;
  showHistory?: boolean;
  showTemplates?: boolean;
  maxHeight?: number;
  className?: string;
}

export const SmartInput: React.FC<SmartInputProps> = ({
  value,
  onChange,
  onSubmit,
  mode = 'natural',
  onModeChange,
  loading = false,
  placeholder,
  suggestions = [],
  history = [],
  templates = [],
  showModeSwitch = true,
  showSuggestions = true,
  showHistory = true,
  showTemplates = true,
  maxHeight = UI_CONSTANTS.INPUT.MAX_HEIGHT,
  className = '',
}) => {
  // 使用 Zustand store 替代 useState
  const {
    currentMode: storeMode,
    showSuggestionsPanel,
    activeTab,
    setCurrentMode,
    setShowSuggestionsPanel,
    setActiveTab,
    closeSuggestionsPanel,
    openSuggestionsPanel
  } = useSmartInput();
  
  // 使用 props 中的 mode 或 store 中的 mode
  const currentMode = mode || storeMode;
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 同步 props mode 到 store
  useEffect(() => {
    if (mode && mode !== storeMode) {
      setCurrentMode(mode as any);
    }
  }, [mode, storeMode, setCurrentMode]);

  // 获取当前模式的占位符
  const getPlaceholder = useCallback(() => {
    if (placeholder) return placeholder;
    
    switch (currentMode) {
      case 'natural':
        return '例如：分析各团队的销售业绩排名、统计本月订单数量和金额...';
      case 'sql':
        return '例如：SELECT * FROM users WHERE age > 18 ORDER BY created_at DESC';
      case 'mixed':
        return '支持自然语言和SQL混合输入，例如：查询用户表中年龄大于18的记录';
      default:
        return '请输入您的查询...';
    }
  }, [placeholder, currentMode]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        maxHeight
      )}px`;
    }
  }, [value, maxHeight]);

  // 处理模式切换
  const handleModeChange = (newMode: InputMode) => {
    setCurrentMode(newMode);
    onModeChange?.(newMode);
  };

  // 处理输入变化 - 使用 Zustand store
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // 显示建议面板 - 使用 store 状态管理
    if (newValue.trim() && showSuggestions) {
      setShowSuggestionsPanel(true);
    } else {
      setShowSuggestionsPanel(false);
    }
  };

  // 处理键盘事件
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEnterPressed(e)) {
        e.preventDefault();
        if (value.trim() && !loading) {
          onSubmit(value.trim(), currentMode);
        }
      }
      
      // ESC 键关闭建议面板 - 使用 store 方法
      if (e.key === 'Escape') {
        closeSuggestionsPanel();
      }
    };
    
    textarea.addEventListener('keydown', handleKeyDown);
    
    return () => {
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  }, [value, currentMode, loading, onSubmit]);

  // 处理建议选择 - 使用 Zustand store
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    closeSuggestionsPanel();
    textareaRef.current?.focus();
  };

  // 处理历史记录选择 - 使用 Zustand store
  const handleHistorySelect = (item: HistoryItem) => {
    onChange(item.query);
    if (item.mode !== currentMode) {
      handleModeChange(item.mode);
    }
    closeSuggestionsPanel();
    textareaRef.current?.focus();
  };

  // 处理模板选择 - 使用 Zustand store
  const handleTemplateSelect = (template: Template) => {
    onChange(template.content);
    if (template.mode !== currentMode) {
      handleModeChange(template.mode);
    }
    closeSuggestionsPanel();
    textareaRef.current?.focus();
  };

  // 渲染模式切换器
  const renderModeSwitch = () => {
    if (!showModeSwitch) return null;
    
    return (
      <div className="tabs tabs-boxed tabs-sm mb-3">
        <button
          className={`tab ${currentMode === 'natural' ? 'tab-active' : ''}`}
          onClick={() => handleModeChange('natural')}
        >
          💬 自然语言
        </button>
        <button
          className={`tab ${currentMode === 'sql' ? 'tab-active' : ''}`}
          onClick={() => handleModeChange('sql')}
        >
          ⚡ SQL模式
        </button>
        <button
          className={`tab ${currentMode === 'mixed' ? 'tab-active' : ''}`}
          onClick={() => handleModeChange('mixed')}
        >
          🔀 混合模式
        </button>
      </div>
    );
  };

  // 渲染建议面板
  const renderSuggestionsPanel = () => {
    if (!showSuggestionsPanel) return null;
    
    const hasSuggestions = suggestions.length > 0;
    const hasHistory = history.length > 0;
    const hasTemplates = templates.length > 0;
    
    if (!hasSuggestions && !hasHistory && !hasTemplates) return null;
    
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
        {/* 标签页 */}
        <div className="tabs tabs-boxed tabs-sm p-2 border-b border-base-300">
          {hasSuggestions && showSuggestions && (
            <button
              className={`tab tab-sm ${activeTab === 'suggestions' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('suggestions')}
            >
              💡 建议 ({suggestions.length})
            </button>
          )}
          {hasHistory && showHistory && (
            <button
              className={`tab tab-sm ${activeTab === 'history' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📚 历史 ({history.length})
            </button>
          )}
          {hasTemplates && showTemplates && (
            <button
              className={`tab tab-sm ${activeTab === 'templates' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              📝 模板 ({templates.length})
            </button>
          )}
        </div>
        
        {/* 内容区域 */}
        <div className="overflow-y-auto max-h-48">
          {activeTab === 'suggestions' && (
            <div className="p-2 space-y-1">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-2 hover:bg-base-200 cursor-pointer rounded text-sm"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <div className="font-medium">{suggestion.text}</div>
                  {suggestion.description && (
                    <div className="text-xs text-base-content/60 mt-1">
                      {suggestion.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="p-2 space-y-1">
              {history.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="p-2 hover:bg-base-200 cursor-pointer rounded text-sm"
                  onClick={() => handleHistorySelect(item)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate flex-1">{item.query}</span>
                    <span className={`badge badge-xs ml-2 ${
                      item.mode === 'natural' ? 'badge-primary' : 
                      item.mode === 'sql' ? 'badge-secondary' : 'badge-accent'
                    }`}>
                      {item.mode}
                    </span>
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {activeTab === 'templates' && (
            <div className="p-2 space-y-1">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-2 hover:bg-base-200 cursor-pointer rounded text-sm"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{template.title}</span>
                    <span className={`badge badge-xs ${
                      template.mode === 'natural' ? 'badge-primary' : 
                      template.mode === 'sql' ? 'badge-secondary' : 'badge-accent'
                    }`}>
                      {template.mode}
                    </span>
                  </div>
                  <div className="text-xs text-base-content/60 mt-1 truncate">
                    {template.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {renderModeSwitch()}
      
      <div className="form-control">
        <label className="label">
          <span className="label-text flex items-center space-x-2">
            <span>
              {currentMode === 'natural' ? '💡' : currentMode === 'sql' ? '⚡' : '🔀'}
            </span>
            <span>
              {currentMode === 'natural' ? '请描述您的数据分析需求' : 
               currentMode === 'sql' ? 'SQL查询模式' : '混合输入模式'}
            </span>
          </span>
        </label>
        
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            placeholder={getPlaceholder()}
            className={`${DAISY_COMPONENTS.INPUT.TEXTAREA} resize-none`}
            style={{ maxHeight }}
            rows={1}
            disabled={loading}
            onFocus={() => value.trim() && setShowSuggestionsPanel(true)}
          />
          
          {renderSuggestionsPanel()}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-3">
        <div className="text-xs text-base-content/60">
          按 Enter 发送，Shift + Enter 换行，ESC 关闭建议
        </div>
        
        <button
          onClick={() => onSubmit(value.trim(), currentMode)}
          disabled={loading || !value.trim()}
          className={`${DAISY_COMPONENTS.BUTTON.PRIMARY} ${DAISY_COMPONENTS.BUTTON.SM}`}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              处理中...
            </>
          ) : (
            currentMode === 'natural' ? '🚀 开始分析' : 
            currentMode === 'sql' ? '⚡ 执行查询' : '🔀 智能处理'
          )}
        </button>
      </div>
    </div>
  );
};

export default SmartInput;