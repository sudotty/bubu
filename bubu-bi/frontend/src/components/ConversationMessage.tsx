import React, { useState, useEffect } from 'react';
import { copyMessageContent } from '../utils/clipboard';
import { UI_CONSTANTS, MESSAGE_TYPES, STYLE_CLASSES } from '../constants/ui';
import DebugInfoPanel from './DebugInfoPanel';
import { DataContainer } from './DataContainer';
import SimpleTable from './SimpleTable';
import type { TableData as NewTableData } from '../types/table';

// 适配器函数：将旧的TableData格式转换为新的格式
const adaptTableData = (oldData: any): NewTableData => {
  if (!oldData || !oldData.columns || !oldData.rows) {
    return { columns: [], rows: [] };
  }
  
  // 处理列数据 - 检查是否已经是对象格式
  const columns = oldData.columns.map((col: any, index: number) => {
    // 如果已经是列对象格式，直接使用
    if (typeof col === 'object' && col !== null && col.key && col.title) {
      return {
        key: col.key,
        title: col.title,
        dataType: col.dataType || 'string' as const,
        sortable: col.sortable !== false
      };
    }
    // 如果是字符串，转换为对象格式
    return {
      key: `col_${index}`,
      title: typeof col === 'string' ? col : String(col),
      dataType: 'string' as const,
      sortable: true
    };
  });
  
  return {
    columns,
    rows: oldData.rows.map((row: any) => {
      const rowObj: Record<string, any> = {};
      
      // 如果 row 已经是对象格式，直接使用
      if (typeof row === 'object' && !Array.isArray(row) && row !== null) {
        return row;
      }
      
      // 如果 row 是数组格式，转换为对象
      if (Array.isArray(row)) {
        row.forEach((cell, index) => {
          rowObj[`col_${index}`] = cell;
        });
        return rowObj;
      }
      
      // 其他情况，返回空对象
      return {};
    })
  };
};
import { ChartVisualization } from './ChartVisualization';
import { EnhancedInsights } from './EnhancedInsights';
import { ErrorBoundary } from './ErrorBoundary';
import { useDataContext } from '../context/DataContext';
import type { ConversationMessage as MessageType } from '../types/data';
import { DebugInfo } from '../types/debug';

interface ConversationMessageProps {
  message: MessageType;
  onSuggestionClick?: (suggestion: string) => void;
  globalDebugMode?: boolean;
  onExport?: (message: MessageType) => void;
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
  const [showChartModal, setShowChartModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);
  const { dispatch } = useDataContext();
  
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
           <ErrorBoundary>
             <DataContainer
               data={message.data}
               enableChart={!!message.chart}
               enableInsights={!!(message.insights && message.insights.length > 0)}
               initialChartType={message.chart?.type || 'bar'}
             >
               {({ optimizedData, chartConfig, insights, handleSort, handleFilter }) => (
                 <div className="space-y-4">
                   {/* 表格工具栏 */}
                   <div className="flex justify-between items-center p-2 bg-base-100 border-b">
                     <span className="text-sm font-medium">数据表格</span>
                     <div className="flex space-x-2">
                       {/* 图表按钮 */}
                       {message.chart && (
                         <button
                           className="btn btn-sm btn-ghost"
                           onClick={async () => {
                             if (!chartData) {
                               setChartData({ config: chartConfig, data: optimizedData });
                             }
                             setShowChartModal(true);
                           }}
                           title="查看图表"
                         >
                           📊
                         </button>
                       )}
                       {/* 洞察按钮 */}
                       {message.insights && message.insights.length > 0 && (
                         <button
                           className="btn btn-sm btn-ghost"
                           onClick={async () => {
                             if (!insightsData) {
                               setInsightsData(optimizedData);
                             }
                             setShowInsightsModal(true);
                           }}
                           title="查看洞察"
                         >
                           💡
                         </button>
                       )}
                     </div>
                   </div>
                   
                   {/* 数据表格 */}
                   <SimpleTable 
                     data={adaptTableData(optimizedData)}
                     features={{
                       sortable: true,
                       fullscreen: true
                     }}
                   />
                 </div>
               )}
             </DataContainer>
           </ErrorBoundary>
         )}
        
        {/* 调试信息面板 */}
        {globalDebugMode && showDebug && message.debugInfo && (
          <DebugInfoPanel 
            debugInfo={message.debugInfo}
            onClose={() => setShowDebug(false)}
          />
        )}
      </div>
      
      {/* 图表弹框 */}
      {showChartModal && chartData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">数据图表</h3>
            <ChartVisualization 
              config={chartData.config}
              data={chartData.data}
              onChartTypeChange={(type) => console.log('Chart type changed:', type)}
            />
            <div className="modal-action">
              <button className="btn" onClick={() => setShowChartModal(false)}>关闭</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowChartModal(false)}></div>
        </div>
      )}
      
      {/* 洞察弹框 */}
      {showInsightsModal && insightsData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">数据洞察</h3>
            <EnhancedInsights 
              data={insightsData}
              onInsightAction={(insight, action) => console.log('Insight action:', insight, action)}
            />
            <div className="modal-action">
              <button className="btn" onClick={() => setShowInsightsModal(false)}>关闭</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowInsightsModal(false)}></div>
        </div>
      )}
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



export default ConversationMessage;