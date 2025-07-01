import React, { useState } from 'react';
import { useEnhancedQueryPanel } from '../hooks/useEnhancedQueryPanel';
import type { File } from '../types';
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
  onTableDataChange: () => Promise<void>;
  files?: File[];
  selectedFiles?: File[];
  onAnalysisComplete?: (analysis: any) => void;
  onProcessingStart?: () => void;
  onProcessingEnd?: () => void;
}

export const EnhancedQueryPanel: React.FC<EnhancedQueryPanelProps> = ({ 
  onTableDataChange, 
  files = [], 
  selectedFiles = [],
  onAnalysisComplete,
  onProcessingStart,
  onProcessingEnd
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
  } = useEnhancedQueryPanel(selectedFiles?.map(file => file.filename));

  // 界面模式状态 - 简化为两种模式
  const [viewMode, setViewMode] = useState<'query' | 'conversation'>('query');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 渲染高级设置面板
  const renderAdvancedSettings = () => (
    showAdvanced && (
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
    )
  );

  // 渲染处理过程可视化
  const renderProcessingVisualization = () => (
    showProcessing && processingSteps.length > 0 && (
      <div className="mb-3">
        <ProcessingVisualization
          steps={processingSteps}
          currentStep={currentStep || undefined}
        />
      </div>
    )
  );

  // 渲染查询模式
  const renderQueryMode = () => (
    <div className="space-y-3">

      
      {/* 查询输入 */}
      <QueryInput
         query={query}
         setQuery={setQuery}
         queryMode={queryMode}
         setQueryMode={setQueryMode}
         queryHistory={queryHistory}
         loading={loading}
         onExecute={executeQuery}
         onProcessNaturalLanguage={() => processNaturalLanguage(query)}
         showSqlPreview={showSqlPreview}
         selectedFile={''}
       />

      {/* 处理过程可视化 */}
      {renderProcessingVisualization()}

      {/* 结果展示 */}
      <EnhancedResultDisplay
         result={result}
         error={error}
         loading={loading}
         query={lastExecutedQuery ?? ''}
         onExport={handleExportToExcel}
         onCopy={() => handleCopy()}
       />
     </div>
   );

  // 渲染对话模式 - 优化布局
  const renderConversationMode = () => (
    <div className="space-y-3">
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
        <div className="bg-base-100 rounded border border-base-300 p-3">
          <h3 className="text-sm font-medium text-base-content mb-2">查询结果</h3>
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
          <div className="flex bg-base-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('query')}
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
              onClick={() => setViewMode('conversation')}
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
          
          {/* 高级设置按钮 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center space-x-1 ${
                showAdvanced
                ? 'bg-primary text-primary-content'
                : 'bg-base-200 text-base-content hover:bg-base-300'
              }`}
          >
            <SettingsIcon />
            <span>高级设置</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* 高级设置 */}
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