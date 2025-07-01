import React, { useState, useRef, useEffect } from 'react';


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
  };
}

import { File } from '../types';

interface ConversationInterfaceProps {
  onQuery: (query: string) => void;
  loading?: boolean;
  conversations: ConversationMessage[];
  onSuggestionClick?: (suggestion: string) => void;
  selectedFiles?: File[];
}

export const ConversationInterface: React.FC<ConversationInterfaceProps> = ({
  onQuery,
  loading = false,
  conversations,
  onSuggestionClick,
  selectedFiles = []
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [globalDebugMode, setGlobalDebugMode] = useState(() => {
    return localStorage.getItem('bubu-debug-mode') === 'true' || 
           window.location.search.includes('debug=true');
  });

  
  // 切换调试模式
  const toggleDebugMode = () => {
    const newMode = !globalDebugMode;
    setGlobalDebugMode(newMode);
    localStorage.setItem('bubu-debug-mode', newMode.toString());
  };





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
      
      {/* 输入区域 */}
      <div className="border-t border-base-300 p-4">
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
}

const ConversationMessage: React.FC<ConversationMessageProps> = ({
  message,
  onSuggestionClick,
  globalDebugMode = false
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
            <SimpleDataTable data={message.data} />
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
}

const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ data }) => {
  if (!data || !data.columns || !data.rows) {
    return (
      <div className="p-4 bg-base-200 rounded-lg text-center text-base-content/60">
        暂无数据
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="bg-base-200">
              {data.columns.map((column, index) => (
                <th key={index} className="font-medium text-base-content">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 10).map((row, rowIndex) => (
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
  );
};

export default ConversationInterface;