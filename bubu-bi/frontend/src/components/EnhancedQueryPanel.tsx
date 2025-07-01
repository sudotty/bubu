import React, { useState } from 'react';
import { useEnhancedQueryPanel } from '../hooks/useEnhancedQueryPanel';
import { QueryInput } from './QueryInput';
import { EnhancedResultDisplay } from './EnhancedResultDisplay';
import { AIConversation } from './AIConversation';
import { ProcessingVisualization } from './ProcessingVisualization';
import { PromptModal } from './PromptModal';
// 使用简单的文本图标替代
const ChatIcon = () => <span>💬</span>;
const CommandIcon = () => <span>⌨️</span>;
const EyeIcon = () => <span>👁️</span>;
const SettingsIcon = () => <span>⚙️</span>;
const SparklesIcon = () => <span>✨</span>;

interface EnhancedQueryPanelProps {
  selectedTable: string;
  onTableDataChange: () => Promise<void>;
  files?: any[];
  onAnalysisComplete?: (analysis: any) => void;
}

export const EnhancedQueryPanel: React.FC<EnhancedQueryPanelProps> = ({ 
  selectedTable, 
  onTableDataChange, 
  files = [], 
  onAnalysisComplete 
}) => {
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
  } = useEnhancedQueryPanel();

  // 界面模式状态 - 简化为两种模式
  const [viewMode, setViewMode] = useState<'query' | 'conversation'>('query');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 渲染简化的模式切换
  const renderModeToggle = () => (
    <div className="flex items-center justify-between mb-4">
      {/* 主要模式切换 */}
      <div className="flex bg-base-200 rounded-lg p-1">
        <button
          onClick={() => setViewMode('query')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'query'
                ? 'bg-base-100 text-primary shadow-sm'
                : 'text-base-content/60 hover:text-base-content'
            }`}
        >
          <CommandIcon />
          数据查询
        </button>
        <button
          onClick={() => setViewMode('conversation')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'conversation'
                ? 'bg-base-100 text-primary shadow-sm'
                : 'text-base-content/60 hover:text-base-content'
            }`}
        >
          <ChatIcon />
          AI对话
        </button>
      </div>

      {/* 辅助功能按钮 */}
      <div className="flex items-center space-x-2">
        {loading && (
          <button
            onClick={() => setShowProcessing(!showProcessing)}
            className="px-3 py-1 text-xs text-primary hover:text-primary-focus transition-colors border border-primary/20 rounded"
          >
            <EyeIcon />
            {showProcessing ? '隐藏' : '查看'}过程
          </button>
        )}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-1 text-xs text-base-content/60 hover:text-base-content transition-colors border border-base-300 rounded"
        >
          <SettingsIcon />
          {showAdvanced ? '收起' : '高级'}
        </button>
      </div>
    </div>
  );

  // 渲染高级设置面板
  const renderAdvancedSettings = () => (
    showAdvanced && (
      <div className="mb-4 p-3 bg-base-100 rounded-lg border border-base-300">
        <h3 className="text-sm font-medium text-base-content mb-3">高级设置</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoAnalysis}
              onChange={(e) => setAutoAnalysis(e.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="ml-2 text-xs text-base-content">自动分析结果</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showSqlPreview}
              onChange={(e) => setShowSqlPreview(e.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="ml-2 text-xs text-base-content">显示SQL预览</span>
          </label>
        </div>
      </div>
    )
  );

  // 渲染处理过程可视化
  const renderProcessingVisualization = () => (
    showProcessing && (
      <div className="mb-4">
        <ProcessingVisualization
          steps={processingSteps}
          currentStep={currentStep ?? undefined}
          compact={false}
        />
      </div>
    )
  );

  // 渲染查询模式 - 重新设计布局，突出数据展示
  const renderQueryMode = () => (
    <div className="space-y-4">
      {/* 紧凑的查询输入区 */}
      <div className="bg-base-100 rounded-lg border border-base-300 p-4">
        <QueryInput
          query={query ?? ''}
          setQuery={setQuery}
          queryMode={queryMode}
          setQueryMode={setQueryMode}
          queryHistory={queryHistory}
          loading={loading}
          onExecute={executeQuery}
          onProcessNaturalLanguage={() => processNaturalLanguage(query)}
          showSqlPreview={showSqlPreview}
          selectedFile={selectedTable}
        />
      </div>

      {/* 处理过程可视化 - 更紧凑 */}
      {renderProcessingVisualization()}

      {/* 数据结果 - 主要内容区域 */}
      <div className="flex-1">
        <EnhancedResultDisplay
          result={result}
          error={error}
          loading={loading}
          query={lastExecutedQuery ?? ''}
          onExport={handleExportToExcel}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );



  // 渲染对话模式 - 优化布局
  const renderConversationMode = () => (
    <div className="space-y-4">
      {/* AI对话组件 - 主要内容区域 */}
      <div className="flex-1">
        <AIConversation
          messages={messages}
          loading={loading}
          onSendMessage={handleAIConversation}
          processingSteps={processingSteps.map(step => step.title)}
          currentProcessingStep={currentStep || undefined}
        />
      </div>

      {/* 处理过程可视化 - 紧凑显示 */}
      {renderProcessingVisualization()}

      {/* 结果展示 - 当有结果时显示 */}
      {result && (
        <div className="bg-base-100 rounded-lg border border-base-300 p-4">
          <h3 className="text-sm font-medium text-base-content mb-3">查询结果</h3>
          <EnhancedResultDisplay
            result={result}
            error={error}
            loading={loading}
            query={lastExecutedQuery ?? ''}
            onExport={handleExportToExcel}
            onCopy={() => handleCopy()}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {/* 模式切换和设置 */}
        {renderModeToggle()}
        {renderAdvancedSettings()}

        {/* 根据模式渲染不同内容 */}
        {viewMode === 'query' && renderQueryMode()}
        {viewMode === 'conversation' && renderConversationMode()}
      </div>

      {/* Prompt模态框组件 */}
      <PromptModal
        showSqlPreview={showSqlPreview}
        setShowSqlPreview={setShowSqlPreview}
        llmResult={llmResult}
        setLlmResult={setLlmResult}
        onExecuteLLMQuery={executeQuery}
        onCopy={handleCopy}
        generateSystemPrompt={generateSystemPrompt}
        loading={loading}
      />
    </div>
  );
};

export default EnhancedQueryPanel;