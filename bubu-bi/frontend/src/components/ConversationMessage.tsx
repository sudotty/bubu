import React, { useState, useEffect } from 'react';
import { copyMessageContent } from '../utils/clipboard';
import { UI_CONSTANTS, MESSAGE_TYPES, STYLE_CLASSES } from '../constants/ui';
import DebugInfoPanel from './DebugInfoPanel';
import SimpleDataTable from './SimpleDataTable';
import { DebugInfo } from '../types/debug';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  data?: any;
  chart?: any;
  insights?: string[];
  suggestions?: string[];
  debugInfo?: DebugInfo;
}

interface ConversationMessageProps {
  message: ConversationMessage;
  onSuggestionClick?: (suggestion: string) => void;
  globalDebugMode?: boolean;
  onExport?: (message: ConversationMessage) => void;
}

export const ConversationMessage: React.FC<ConversationMessageProps> = ({
  message,
  onSuggestionClick,
  globalDebugMode = false,
  onExport
}) => {
  const isUser = message.type === MESSAGE_TYPES.USER;
  const isError = message.type === MESSAGE_TYPES.ERROR;
  const [showDebug, setShowDebug] = useState(false);
  
  // 调试日志
  useEffect(() => {
    console.log('🔧 [DEBUG] ConversationMessage:', {
      messageId: message.id,
      globalDebugMode,
      hasDebugInfo: !!message.debugInfo,
      showDebug,
      isUser: message.type === 'user'
    });
    if (globalDebugMode && message.debugInfo) {
      console.log('🔧 [DEBUG] Debug info for message:', message.debugInfo);
    }
  }, [globalDebugMode, message.debugInfo, showDebug, message.id, message.type]);
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[${UI_CONSTANTS.MESSAGE.MAX_WIDTH_PERCENTAGE}] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 消息头 */}
        <MessageHeader 
          isUser={isUser}
          isError={isError}
          timestamp={message.timestamp}
          debugMode={globalDebugMode}
          hasDebugInfo={!!message.debugInfo}
          showDebug={showDebug}
          onToggleDebug={() => {
            console.log('🔧 [DEBUG] 切换showDebug状态:', { from: showDebug, to: !showDebug });
            setShowDebug(!showDebug);
          }}
        />
        
        {/* 消息内容 */}
        <MessageContent 
          content={message.content}
          isUser={isUser}
          isError={isError}
        />
        
        {/* 数据结果 */}
        {message.data && (
          <div className="mt-3">
            <SimpleDataTable 
              data={message.data} 
              onExport={() => onExport?.(message)}
              definition={message.insights?.find(insight => 
                !insight.includes('置信度:') && 
                !insight.includes('请提供更具体的查询条件')
              )}
            />
          </div>
        )}
        
        {/* 洞察信息 */}
        {message.insights && message.insights.length > 0 && (
          <InsightsPanel insights={message.insights} />
        )}
        
        {/* 调试信息面板 */}
        {globalDebugMode && showDebug && message.debugInfo && (
          <DebugInfoPanel 
            debugInfo={message.debugInfo}
            onClose={() => setShowDebug(false)}
          />
        )}
      </div>
    </div>
  );
};

// 消息头组件
interface MessageHeaderProps {
  isUser: boolean;
  isError: boolean;
  timestamp: Date;
  debugMode: boolean;
  hasDebugInfo: boolean;
  showDebug: boolean;
  onToggleDebug: () => void;
}

const MessageHeader: React.FC<MessageHeaderProps> = ({
  isUser,
  isError,
  timestamp,
  debugMode,
  hasDebugInfo,
  showDebug,
  onToggleDebug
}) => (
  <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2} mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
    {!isUser && (
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
        isError ? 'bg-error text-error-content' : 'bg-secondary text-secondary-content'
      }`}>
        {isError ? UI_CONSTANTS.ICONS.ERROR : UI_CONSTANTS.ICONS.ROBOT}
      </div>
    )}
    <span className={`${STYLE_CLASSES.TEXT_XS} text-base-content/50`}>
      {timestamp.toLocaleTimeString()}
    </span>
    {/* 调试按钮（仅在调试模式下显示） */}
    {debugMode && hasDebugInfo && !isUser && (
      <button
        onClick={() => {
          console.log('🔧 [DEBUG] 调试按钮被点击');
          onToggleDebug();
        }}
        className={`${STYLE_CLASSES.TEXT_XS} px-2 py-1 bg-warning/20 text-warning rounded hover:bg-warning/30 transition-colors`}
        title="查看调试信息"
      >
        {UI_CONSTANTS.ICONS.DEBUG} Debug
      </button>
    )}
    {isUser && (
      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs text-primary-content">
        {UI_CONSTANTS.ICONS.USER}
      </div>
    )}
  </div>
);

// 消息内容组件
interface MessageContentProps {
  content: string;
  isUser: boolean;
  isError: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({
  content,
  isUser,
  isError
}) => {
  const handleCopy = () => {
    copyMessageContent(content);
  };

  return (
    <div className={`rounded-lg p-3 relative group ${
      isUser 
        ? 'bg-primary text-primary-content' 
        : isError 
          ? 'bg-error/10 text-error border border-error/20'
          : 'bg-base-200 text-base-content'
    }`}>
      <p className="whitespace-pre-wrap select-text cursor-text" style={{ userSelect: 'text' }}>
        {content}
      </p>
      
      {/* 复制按钮 */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 btn btn-ghost btn-xs text-xs"
        title="复制消息内容"
      >
        {UI_CONSTANTS.ICONS.COPY}
      </button>
    </div>
  );
};

// 洞察信息面板组件
interface InsightsPanelProps {
  insights: string[];
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => (
  <div className="mt-3 p-3 bg-info/10 border border-info/20 rounded-lg">
    <h4 className="font-medium text-info mb-2 flex items-center">
      <span className="mr-1">{UI_CONSTANTS.ICONS.INSIGHTS}</span>
      数据洞察
    </h4>
    <ul className={`${STYLE_CLASSES.SPACE_Y_3} ${STYLE_CLASSES.TEXT_SMALL} text-base-content/80`}>
      {insights.map((insight, index) => (
        <li key={index} className="flex items-start space-x-2">
          <span className="text-info mt-0.5">•</span>
          <span>{insight}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default ConversationMessage;