import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExportToExcel } from '../../wailsjs/go/main/App';
import { useNotificationMethods } from './NotificationSystem';


interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  data?: any;
  chart?: any;
  insights?: string[];

  // 调试信息（仅开发者可见）
  debugInfo?: {
    originalPrompt?: string;
    llmRawResponse?: any;
    processingTime?: number;
    apiEndpoint?: string;
    modelUsed?: string;
    generatedSQL?: string;
  };
}

import { File } from '../types';

interface ConversationInterfaceProps {
  onQuery: (query: string) => void;
  loading?: boolean;
  conversations: ConversationMessage[];
  onSuggestionClick?: (suggestion: string) => void;
  selectedFiles?: File[];
  templates?: any[];
  showTemplates?: boolean;
  setShowTemplates?: (show: boolean) => void;
  onSaveTemplate?: (title: string, promptText: string, sql: string, description: string) => Promise<void>;
  onUseTemplate?: (templateId: number) => Promise<void>;
  onDeleteTemplate?: (templateId: number) => Promise<void>;
}

export const ConversationInterface: React.FC<ConversationInterfaceProps> = ({
  onQuery,
  loading = false,
  conversations,
  onSuggestionClick,
  selectedFiles = [],
  templates = [],
  showTemplates = false,
  setShowTemplates,
  onSaveTemplate,
  onUseTemplate,
  onDeleteTemplate
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [globalDebugMode, setGlobalDebugMode] = useState(() => {
    return localStorage.getItem('bubu-debug-mode') === 'true' || 
           window.location.search.includes('debug=true');
  });
  const { success, error } = useNotificationMethods();

  
  // 切换调试模式
  const toggleDebugMode = () => {
    const newMode = !globalDebugMode;
    setGlobalDebugMode(newMode);
    localStorage.setItem('bubu-debug-mode', newMode.toString());
  };

  // 下载数据功能
  const handleExportData = useCallback(async (message: ConversationMessage) => {
    try {
      // 尝试从调试信息中获取生成的SQL查询
      let sqlQuery = '';
      if (message.debugInfo?.generatedSQL) {
        // 使用生成的SQL查询
        sqlQuery = message.debugInfo.generatedSQL;
      } else {
        // 如果没有生成的SQL，说明这不是一个数据查询消息
        error('无法获取SQL查询，该消息可能不包含数据查询结果');
        return;
      }
      
      const filePath = await ExportToExcel(sqlQuery);
      success(`Excel文件已保存到: ${filePath}`);
    } catch (err) {
      console.error('导出数据失败:', err);
      error('导出数据失败，请稍后重试');
    }
  }, [success, error]);





  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !loading) {
      onQuery(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };



  return (
    <div className="flex flex-col h-full bg-base-100 relative">
      {/* 调试模式切换按钮 */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleDebugMode}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            globalDebugMode 
              ? 'bg-warning text-warning-content' 
              : 'bg-base-300 text-base-content/60 hover:bg-base-200'
          }`}
          title={globalDebugMode ? '关闭调试模式' : '开启调试模式'}
        >
          {globalDebugMode ? '🔧 调试模式' : '🔧'}
        </button>
      </div>
      
      {/* 对话历史 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversations.length === 0 ? (
          // 欢迎界面
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold text-base-content mb-2">BuBu AI 助手</h2>
              <p className="text-base-content/60 mb-6">用自然语言描述你想了解的数据，我来帮你分析</p>
            </div>
          </div>
        ) : (
          // 对话消息列表
          conversations.map((message) => (
            <ConversationMessage 
              key={message.id} 
              message={message} 
              onSuggestionClick={onSuggestionClick}
              globalDebugMode={globalDebugMode}
              onExport={handleExportData}
            />
          ))
        )}
        
        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start space-x-2 max-w-[80%]">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm">
                🤖
              </div>
              <div className="bg-base-200 rounded-lg p-3 ml-2">
                <div className="flex items-center space-x-2">
                  <div className="loading loading-dots loading-sm"></div>
                  <span className="text-sm text-base-content/70">正在分析中...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 话术本界面 */}
      {showTemplates && (
        <div className="border-t border-base-300 bg-base-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📝 话术本</h3>
            <button
              onClick={() => setShowTemplates?.(false)}
              className="btn btn-ghost btn-sm"
            >
              ✕
            </button>
          </div>
          
          {templates.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <div className="text-4xl mb-2">📝</div>
              <p>暂无话术本</p>
              <p className="text-sm">保存常用查询作为话术本，方便快速使用</p>
            </div>
          ) : (
            <div className="grid gap-3 max-h-60 overflow-y-auto">
              {templates.map((template) => (
                <div key={template.id} className="bg-base-100 p-3 rounded-lg border border-base-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{template.title}</h4>
                      <p className="text-xs text-base-content/60 mt-1">{template.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-base-content/50">
                        <span>使用次数: {template.usage_count}</span>
                        <span>最后使用: {new Date(template.last_used_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => {
                          onUseTemplate?.(template.id);
                          setInput(template.prompt_text);
                        }}
                        className="btn btn-ghost btn-xs"
                        title="使用话术本"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => onDeleteTemplate?.(template.id)}
                        className="btn btn-ghost btn-xs text-error"
                        title="删除话术本"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 输入区域 */}
      <div className="border-t border-base-300 p-4">
        {/* 话术本和功能按钮 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTemplates?.(!showTemplates)}
              className={`btn btn-sm ${
                showTemplates ? 'btn-primary' : 'btn-ghost'
              }`}
              title="话术本"
            >
              📝 话术本 ({templates.length})
            </button>
            <div className="text-xs text-base-content/50 flex items-center">
              💡 输入 #bubu# 开头可直接执行话术本模式
            </div>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="用自然语言描述你想了解的数据..."
              className="w-full p-3 border border-base-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-base-100"
              rows={1}
              disabled={loading}
            />
            <div className="mt-1 text-xs text-base-content/50">
              按 Enter 发送，Shift + Enter 换行
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="loading loading-spinner loading-sm"></div>
                <span>分析中</span>
              </div>
            ) : (
              '发送'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// 对话消息组件
interface ConversationMessageProps {
  message: ConversationMessage;
  onSuggestionClick?: (suggestion: string) => void;
  globalDebugMode?: boolean;
  onExport?: (message: ConversationMessage) => void;
}

const ConversationMessage: React.FC<ConversationMessageProps> = ({
  message,
  onSuggestionClick,
  globalDebugMode = false,
  onExport
}) => {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';
  const [showDebug, setShowDebug] = useState(false);
  const debugMode = globalDebugMode;
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 消息头 */}
        <div className={`flex items-center space-x-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {!isUser && (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              isError ? 'bg-error text-error-content' : 'bg-secondary text-secondary-content'
            }`}>
              {isError ? '⚠️' : '🤖'}
            </div>
          )}
          <span className="text-xs text-base-content/50">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {/* 调试按钮（仅在调试模式下显示） */}
          {debugMode && message.debugInfo && !isUser && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs px-2 py-1 bg-warning/20 text-warning rounded hover:bg-warning/30 transition-colors"
              title="查看调试信息"
            >
              🔍 Debug
            </button>
          )}
          {isUser && (
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs text-primary-content">
              👤
            </div>
          )}
        </div>
        
        {/* 消息内容 */}
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-primary text-primary-content' 
            : isError 
              ? 'bg-error/10 text-error border border-error/20'
              : 'bg-base-200 text-base-content'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* 数据结果 */}
        {message.data && (
          <div className="mt-3">
            <SimpleDataTable 
              data={message.data} 
              onExport={() => onExport?.(message)}
            />
          </div>
        )}
        
        {/* 洞察信息 */}
        {message.insights && message.insights.length > 0 && (
          <div className="mt-3 p-3 bg-info/10 border border-info/20 rounded-lg">
            <h4 className="font-medium text-info mb-2 flex items-center">
              <span className="mr-1">💡</span>
              数据洞察
            </h4>
            <ul className="space-y-1 text-sm text-base-content/80">
              {message.insights.map((insight, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-info mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        

        
        {/* 调试信息面板 */}
        {debugMode && showDebug && message.debugInfo && (
          <div className="mt-3 p-4 bg-warning/5 border border-warning/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-warning flex items-center">
                <span className="mr-2">🔧</span>
                调试信息
              </h4>
              <button
                onClick={() => setShowDebug(false)}
                className="text-warning/60 hover:text-warning text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* 模型信息 */}
              {message.debugInfo.modelUsed && (
                <div>
                  <span className="font-medium text-warning">模型:</span>
                  <span className="ml-2 text-base-content/80">{message.debugInfo.modelUsed}</span>
                </div>
              )}
              
              {/* API端点 */}
              {message.debugInfo.apiEndpoint && (
                <div>
                  <span className="font-medium text-warning">API端点:</span>
                  <span className="ml-2 text-base-content/80 font-mono text-xs">{message.debugInfo.apiEndpoint}</span>
                </div>
              )}
              
              {/* 处理时间 */}
              {message.debugInfo.processingTime && (
                <div>
                  <span className="font-medium text-warning">处理时间:</span>
                  <span className="ml-2 text-base-content/80">{message.debugInfo.processingTime}ms</span>
                </div>
              )}
              
              {/* 原始Prompt */}
              {message.debugInfo.originalPrompt && (
                <div>
                  <span className="font-medium text-warning">原始Prompt:</span>
                  <div className="mt-1 p-2 bg-base-100 rounded border text-xs font-mono max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{message.debugInfo.originalPrompt}</pre>
                  </div>
                </div>
              )}
              
              {/* LLM原始响应 */}
              {message.debugInfo.llmRawResponse && (
                <div>
                  <span className="font-medium text-warning">LLM原始响应:</span>
                  <div className="mt-1 p-2 bg-base-100 rounded border text-xs font-mono max-h-40 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">
                      {typeof message.debugInfo.llmRawResponse === 'string' 
                        ? message.debugInfo.llmRawResponse 
                        : JSON.stringify(message.debugInfo.llmRawResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 简单数据表格组件
interface SimpleDataTableProps {
  data: {
    columns: string[];
    rows: any[][];
    total: number;
  };
  onExport?: () => void;
}

const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ data, onExport }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // 虚拟化参数
  const ROW_HEIGHT = 40; // 每行高度
  const VISIBLE_ROWS = 50; // 可见行数

  // 优化的全屏切换函数
  const toggleFullscreen = React.useCallback((enable: boolean) => {
    if (isTransitioning) return; // 防止重复点击
    
    setIsTransitioning(true);
    
    if (enable) {
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsFullscreen(false);
      document.body.style.overflow = 'unset';
    }
    
    // 动画完成后重置过渡状态
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning]);

  // 监听ESC键退出全屏
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && !isTransitioning) {
        toggleFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, isTransitioning, toggleFullscreen]);

  // 清理函数
  React.useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // 排序处理
  const handleSort = (column: string) => {
    setSortConfig(current => {
      if (current?.key === column) {
        return current.direction === 'asc' 
          ? { key: column, direction: 'desc' }
          : null;
      }
      return { key: column, direction: 'asc' };
    });
  };

  // 优化的排序数据 - 使用分页和延迟计算
  const sortedData = React.useMemo(() => {
    if (!data || !sortConfig) return data;
    
    const columnIndex = data.columns.indexOf(sortConfig.key);
    if (columnIndex === -1) return data;

    // 对于大数据集，只排序前1000条用于显示
    const maxSortRows = Math.min(data.rows.length, 1000);
    const rowsToSort = data.rows.slice(0, maxSortRows);
    
    const sortedRows = rowsToSort.sort((a, b) => {
      const aVal = a[columnIndex];
      const bVal = b[columnIndex];
      
      // 快速数值比较
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // 优化的字符串比较
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const result = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? result : -result;
    });
    
    // 如果有剩余数据，追加到末尾
    const remainingRows = data.rows.length > maxSortRows ? data.rows.slice(maxSortRows) : [];
    const finalRows = [...sortedRows, ...remainingRows];

    return { ...data, rows: finalRows };
  }, [data, sortConfig]);

  // 虚拟化计算
  const { visibleRows, startIndex, startOffset, endOffset } = React.useMemo(() => {
    if (!sortedData?.rows) {
      return { visibleRows: [], startIndex: 0, startOffset: 0, endOffset: 0 };
    }

    const totalRows = sortedData.rows.length;
    const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
    const endIndex = Math.min(startIndex + VISIBLE_ROWS, totalRows);
    
    const visibleRows = sortedData.rows.slice(startIndex, endIndex);
    const startOffset = startIndex * ROW_HEIGHT;
    const endOffset = (totalRows - endIndex) * ROW_HEIGHT;

    return { visibleRows, startIndex, startOffset, endOffset };
  }, [sortedData, scrollTop, ROW_HEIGHT, VISIBLE_ROWS]);

  // 防抖的滚动处理
  const handleScroll = React.useCallback(
    React.useMemo(() => {
      let timeoutId: number;
      return (e: React.UIEvent<HTMLDivElement>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          setScrollTop(e.currentTarget.scrollTop);
        }, 16); // 约60fps
      };
    }, []),
    []
  );

  if (!data || !data.columns || !data.rows) {
    return (
      <div className="p-4 bg-base-200 rounded-lg text-center text-base-content/60">
        暂无数据
      </div>
    );
  }

  return (
    <>
      <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
        {/* 标题栏 */}
        <div className="p-3 border-b border-base-300 bg-base-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📊</span>
              <h3 className="font-medium">数据表格</h3>
              <span className="text-sm text-base-content/50">({data.total} 条记录)</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* 下载按钮 */}
              <button 
                className="btn btn-ghost btn-sm"
                onClick={onExport}
                disabled={!data || !data.rows || data.rows.length === 0}
                title="下载全部数据"
              >
                📥 下载
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => toggleFullscreen(true)}
                disabled={isTransitioning}
                title="全屏显示"
              >
                🔍 全屏
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200">
                {data.columns.map((column, index) => (
                  <th 
                    key={index} 
                    className="font-medium text-base-content cursor-pointer hover:bg-base-300"
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column}</span>
                      {sortConfig?.key === column && (
                        <span className="text-xs">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sortedData || data).rows.slice(0, 10).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="text-base-content">
                      {cell !== null && cell !== undefined ? String(cell) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total > 10 && (
          <div className="p-3 bg-base-200 text-center text-sm text-base-content/60">
            显示前 10 条，共 {data.total} 条数据
          </div>
        )}
      </div>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <div className={`fixed inset-0 z-50 bg-base-100 transition-all duration-300 ease-in-out ${
          isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          {/* 全屏标题栏 */}
          <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📊</span>
              <h3 className="font-semibold">数据表格 - 全屏模式</h3>
              <span className="text-sm text-base-content/50">({data.total} 条记录)</span>
            </div>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => toggleFullscreen(false)}
              disabled={isTransitioning}
              title="退出全屏"
            >
              ✕ 退出全屏
            </button>
          </div>

          {/* 全屏表格内容 - 虚拟化渲染 */}
          <div className="flex-1 overflow-auto p-4" ref={containerRef} onScroll={handleScroll}>
            <div className="overflow-x-auto h-full">
              <table className="table table-zebra table-sm w-full">
                <thead className="sticky top-0 bg-base-200 z-10">
                  <tr>
                    {data.columns.map((column, index) => (
                      <th 
                        key={`header-${index}`} 
                        className="cursor-pointer hover:bg-base-300 font-medium transition-colors duration-150"
                        onClick={() => handleSort(column)}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{column}</span>
                          {sortConfig?.key === column && (
                            <span className="text-xs transition-transform duration-150">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 虚拟化渲染：只渲染可见行 */}
                  <tr style={{ height: startOffset }}><td colSpan={data.columns.length}></td></tr>
                  {visibleRows.map((row, index) => (
                    <tr key={`fullscreen-row-${startIndex + index}`} className="hover:bg-base-200 transition-colors duration-150">
                      {row.map((cell, cellIndex) => (
                        <td key={`fullscreen-cell-${startIndex + index}-${cellIndex}`} className="px-4 py-2">
                          {cell === null || cell === undefined ? (
                            <span className="text-base-content/30 italic">null</span>
                          ) : (
                            <div className="max-w-xs overflow-hidden">
                              <span className="block truncate" title={String(cell)}>
                                {String(cell)}
                              </span>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ height: endOffset }}><td colSpan={data.columns.length}></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 全屏底部状态栏 */}
          <div className="p-4 border-t border-base-300 bg-base-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-base-content/70">
                💡 提示：点击列标题可以排序，按 ESC 键退出全屏
              </div>
              <div className="text-sm text-base-content/50">
                共 {data.total} 条记录，{data.columns.length} 个字段
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConversationInterface;