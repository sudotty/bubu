import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'processing' | 'completed' | 'error';
  metadata?: {
    sql?: string;
    confidence?: number;
    processingSteps?: string[];
  };
}

interface AIConversationProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loading: boolean;
  currentProcessingStep?: string;
  processingSteps?: string[];
}

export const AIConversation: React.FC<AIConversationProps> = ({
  messages,
  onSendMessage,
  loading,
  currentProcessingStep,
  processingSteps = []
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 处理发送消息
  const handleSendMessage = () => {
    if (!inputMessage.trim() || loading) return;
    
    onSendMessage(inputMessage.trim());
    setInputMessage('');
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
          {/* 头像 */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
            isUser ? 'bg-primary text-primary-content' : 
            isSystem ? 'bg-warning text-warning-content' :
            'bg-secondary text-secondary-content'
          }`}>
            {isUser ? '👤' : isSystem ? '⚙️' : '🤖'}
          </div>

          {/* 消息内容 */}
          <div className={`flex-1 ${isUser ? 'mr-2' : 'ml-2'}`}>
            <div className={`rounded-lg p-3 ${
              isUser ? 'bg-primary text-primary-content' :
              isSystem ? 'bg-warning/10 border border-warning/20' :
              'bg-base-200'
            }`}>
              {/* 消息文本 */}
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* SQL预览 */}
              {message.metadata?.sql && (
                <div className="mt-2 p-2 bg-base-300 rounded text-xs font-mono">
                  <div className="text-base-content/70 mb-1">生成的SQL:</div>
                  <div className="text-base-content">{message.metadata.sql}</div>
                </div>
              )}

              {/* 置信度 */}
              {message.metadata?.confidence && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs text-base-content/70">置信度:</span>
                  <div className="flex-1 bg-base-300 rounded-full h-2">
                    <div 
                      className="bg-success h-2 rounded-full transition-all duration-300"
                      style={{ width: `${message.metadata.confidence}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-base-content/70">
                    {message.metadata.confidence}%
                  </span>
                </div>
              )}

              {/* 处理步骤 */}
              {message.metadata?.processingSteps && message.metadata.processingSteps.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-base-content/70 mb-1">处理步骤:</div>
                  <div className="space-y-1">
                    {message.metadata.processingSteps.map((step, index) => (
                      <div key={index} className="flex items-center space-x-2 text-xs">
                        <span className="text-success">✓</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 时间戳 */}
            <div className={`text-xs text-base-content/50 mt-1 ${
              isUser ? 'text-right' : 'text-left'
            }`}>
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染处理状态
  const renderProcessingStatus = () => {
    if (!loading) return null;

    return (
      <div className="flex justify-start mb-4">
        <div className="flex max-w-[80%] items-start space-x-2">
          {/* AI头像 */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center text-sm">
            🤖
          </div>

          {/* 处理状态 */}
          <div className="ml-2">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <span className="loading loading-dots loading-sm"></span>
                <span className="text-sm font-medium">AI正在思考中...</span>
              </div>

              {/* 当前处理步骤 */}
              {currentProcessingStep && (
                <div className="text-xs text-base-content/70 mb-2">
                  当前步骤: {currentProcessingStep}
                </div>
              )}

              {/* 处理步骤列表 */}
              {processingSteps.length > 0 && (
                <div className="space-y-1">
                  {processingSteps.map((step, index) => {
                    const isCurrentStep = step === currentProcessingStep;
                    const isCompleted = processingSteps.indexOf(currentProcessingStep || '') > index;
                    
                    return (
                      <div key={index} className="flex items-center space-x-2 text-xs">
                        {isCompleted ? (
                          <span className="text-success">✓</span>
                        ) : isCurrentStep ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <span className="text-base-content/30">○</span>
                        )}
                        <span className={isCurrentStep ? 'font-medium' : isCompleted ? 'text-success' : 'text-base-content/50'}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-base-100">
      {/* 对话标题 */}
      <div className="flex-shrink-0 p-4 border-b border-base-300">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold">AI分析助手</h3>
          <div className="flex-1"></div>
          <div className="text-xs text-base-content/50">
            {messages.length} 条对话
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-medium mb-2">开始与AI对话</h3>
            <p className="text-base-content/70 max-w-md">
              描述您想要分析的数据，AI助手将帮您生成相应的查询并提供分析结果。
            </p>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            {renderProcessingStatus()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="flex-shrink-0 p-4 border-t border-base-300">
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              className="textarea textarea-bordered w-full resize-none"
              placeholder="输入您的分析需求..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={loading}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              '发送'
            )}
          </button>
        </div>
        
        {/* 快捷操作 */}
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-base-content/50">
            按 Enter 发送，Shift + Enter 换行
          </div>
          <div className="flex space-x-2">
            <button 
              className="btn btn-ghost btn-xs"
              onClick={() => setInputMessage('')}
              disabled={loading}
            >
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};