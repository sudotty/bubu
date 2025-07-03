import React, { useState, useCallback, useMemo } from 'react';
import { useEnhancedQueryPanel } from '../hooks/useEnhancedQueryPanel';
import type { FileInfo } from '../types';
import { SmartInput } from './SmartInput';
import { AIConversation } from './AIConversation';
import EnhancedPromptModal from './EnhancedPromptModal';

// 类型定义
type ViewMode = 'query' | 'conversation';

interface IconProps {
  className?: string;
}

// 图标组件
const ChatIcon: React.FC<IconProps> = ({ className }) => <span className={className}>💬</span>;
const CommandIcon: React.FC<IconProps> = ({ className }) => <span className={className}>⌨️</span>;
const SettingsIcon: React.FC<IconProps> = ({ className }) => <span className={className}>⚙️</span>;

interface EnhancedQueryPanelProps {
  files?: FileInfo[];
  selectedFiles?: FileInfo[];
  onAnalysisComplete?: (analysis: any) => void;
  onProcessingStart?: () => void;
  onProcessingEnd?: () => void;
}

export const EnhancedQueryPanel: React.FC<EnhancedQueryPanelProps> = ({ 
  files = [], 
  selectedFiles = [],
  onAnalysisComplete,
  onProcessingStart,
  onProcessingEnd
}) => {
  // 计算选中文件名
  const selectedFileNames = useMemo(() => 
    selectedFiles?.map(file => file.filename) || [], 
    [selectedFiles]
  );

  const {
    // 基础状态
    query,
    setQuery,
    result,
    loading,
    error,
    queryHistory,
    queryMode,
    setQueryMode,
    llmResult,
    showSqlPreview,
    setShowSqlPreview,
    copySuccess,
    exporting,
    lastExecutedQuery,

    // AI对话功能
    messages,
    conversationMode,
    setConversationMode,
    handleAIConversation,
    clearConversation,

    // 处理过程可视化
    processingSteps,
    currentStep,
    showProcessing,
    setShowProcessing,

    // 智能分析
    analysisInsights,
    autoAnalysis,
    setAutoAnalysis,

    // 功能函数
    generateSystemPrompt,
    handleCopy,
    processNaturalLanguage,
    executeQuery,
    handleExportToExcel,
    setLlmResult,
  } = useEnhancedQueryPanel(selectedFileNames);

  // 界面模式状态
  const [viewMode, setViewMode] = useState<ViewMode>('query');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 优化的事件处理函数
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const toggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  // 视图模式切换组件
  const ViewModeToggle: React.FC<{
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
  }> = useCallback(({ viewMode, onViewModeChange }) => (
    <div className="flex bg-base-200 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('query')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
          viewMode === 'query'
            ? 'bg-base-100 text-primary shadow-sm'
            : 'text-base-content/60 hover:text-base-content'
        }`}
      >
        <CommandIcon />
        <span>数据查询</span>
      </button>
      <button
        onClick={() => onViewModeChange('conversation')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
          viewMode === 'conversation'
            ? 'bg-base-100 text-primary shadow-sm'
            : 'text-base-content/60 hover:text-base-content'
        }`}
      >
        <ChatIcon />
        <span>AI对话</span>
      </button>
    </div>
  ), []);

  // 高级设置切换按钮组件
  const AdvancedToggleButton: React.FC<{
    showAdvanced: boolean;
    onToggle: () => void;
  }> = useCallback(({ showAdvanced, onToggle }) => (
    <button
      onClick={onToggle}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center space-x-1 ${
        showAdvanced
          ? 'bg-primary text-primary-content'
          : 'bg-base-200 text-base-content hover:bg-base-300'
      }`}
    >
      <SettingsIcon />
      <span>高级设置</span>
    </button>
  ), []);

  // 高级设置组件
  const AdvancedSettings: React.FC = useCallback(() => {
    if (!showAdvanced) return null;
    
    return (
      <div className="mb-3 p-2 bg-base-100 rounded border border-base-300">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoAnalysis}
              onChange={(e) => setAutoAnalysis(e.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="ml-1.5 text-xs text-base-content">自动分析结果</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showSqlPreview}
              onChange={(e) => setShowSqlPreview(e.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="ml-1.5 text-xs text-base-content">显示SQL预览</span>
          </label>
        </div>
      </div>
    );
  }, [showAdvanced, autoAnalysis, setAutoAnalysis, showSqlPreview, setShowSqlPreview]);

  // 处理过程可视化组件
  const ProcessingSection: React.FC = useCallback(() => {
    if (!showProcessing || processingSteps.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="text-sm text-base-content/70">
          {currentStep && `正在处理: ${currentStep}`}
        </div>
      </div>
    );
  }, [showProcessing, processingSteps, currentStep]);

  // 查询模式组件
  const QueryModeContent: React.FC = useCallback(() => (
    <div className="space-y-3">
      <SmartInput
        value={query}
        onChange={setQuery}
        mode={queryMode === 'natural' ? 'natural' : 'sql'}
        onModeChange={(mode) => setQueryMode(mode === 'natural' ? 'natural' : 'sql')}
        history={[]}
        loading={loading}
        onSubmit={executeQuery}
        
        showModeSwitch={true}
        placeholder={queryMode === 'natural' ? '请输入自然语言查询...' : '请输入SQL查询...'}
      />
      <ProcessingSection />
      {result && (
        <div className="bg-base-100 rounded border border-base-300 p-3">
          <h3 className="text-sm font-medium text-base-content mb-2">查询结果</h3>
          <div className="text-sm text-base-content/70">
            查询已完成，结果已处理
          </div>
        </div>
      )}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded p-3">
          <div className="text-error text-sm">{error}</div>
        </div>
      )}
    </div>
  ), [query, setQuery, queryMode, setQueryMode, queryHistory, loading, executeQuery, processNaturalLanguage, showSqlPreview, result, error, lastExecutedQuery, handleExportToExcel, handleCopy]);

  // 对话模式组件
  const ConversationModeContent: React.FC = useCallback(() => (
    <div className="space-y-3">
      <div className="flex-1">
        <AIConversation
          messages={messages}
          loading={loading}
          onSendMessage={handleAIConversation}
          processingSteps={processingSteps.map(step => step.title)}
          currentProcessingStep={currentStep || undefined}
        />
      </div>
      <ProcessingSection />
      {result && (
        <div className="bg-base-100 rounded border border-base-300 p-3">
          <h3 className="text-sm font-medium text-base-content mb-2">查询结果</h3>
          <div className="text-sm text-base-content/70">
             查询已完成，结果已处理
           </div>
        </div>
      )}
    </div>
  ), [messages, loading, handleAIConversation, processingSteps, currentStep, result, error, lastExecutedQuery, handleExportToExcel, handleCopy]);

  return (
    <div className="h-full flex flex-col bg-base-100 relative">
      {/* 遮罩层 - 当没有选择文件时显示，覆盖整个右侧面板 */}
      {selectedFiles.length === 0 && (
        <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-base-content mb-2">选择数据源开始分析</h3>
            <p className="text-base-content/60">请先在左侧选择一个或多个文件作为数据源</p>
          </div>
        </div>
      )}
      
      {/* 右侧顶部功能区 */}
      <div className="px-4 py-3 border-b border-base-300">
        
        <div className="flex items-center justify-between">
          {/* 视图模式切换 */}
          <ViewModeToggle 
            viewMode={viewMode} 
            onViewModeChange={handleViewModeChange} 
          />
          
          {/* 高级设置按钮 */}
          <AdvancedToggleButton 
            showAdvanced={showAdvanced} 
            onToggle={toggleAdvanced} 
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* 高级设置 */}
        <AdvancedSettings />

        {/* 根据模式渲染不同内容 */}
        {viewMode === 'query' && <QueryModeContent />}
        {viewMode === 'conversation' && <ConversationModeContent />}
      </div>

      {/* 增强的Prompt模态框 */}
      <EnhancedPromptModal
        showSqlPreview={showSqlPreview}
        setShowSqlPreview={setShowSqlPreview}
        llmResult={llmResult}
        setLlmResult={setLlmResult}
        onExecuteLLMQuery={executeQuery}
        onCopy={handleCopy}
        generateSystemPrompt={generateSystemPrompt}
        loading={loading}
        onSqlEdit={(sql) => {
           if (llmResult) {
             setLlmResult({ ...llmResult, sql, convertValues: llmResult.convertValues });
           }
         }}
      />
    </div>
  );
};

export default EnhancedQueryPanel;