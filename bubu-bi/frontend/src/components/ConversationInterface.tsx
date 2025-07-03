import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExportToExcel } from '../../wailsjs/go/main/App';
import { useNotificationMethods } from './NotificationSystem';
import { File } from '../types';
import { UI_CONSTANTS, MESSAGE_TYPES } from '../constants/ui';
import { isEscapePressed } from '../utils/keyboard';
import { ConversationMessage } from '../types/data';

// 组件导入
import { ConversationMessage as ConversationMessageComponent } from './ConversationMessage';
import TemplatePanel from './TemplatePanel';
import InputArea from './InputArea';
import WelcomeScreen from './WelcomeScreen';
import LoadingMessage from './LoadingMessage';

import SimpleDataTable from './SimpleDataTable';

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
  const toggleDebugMode = useCallback(() => {
    const newMode = !globalDebugMode;
    setGlobalDebugMode(newMode);
    localStorage.setItem('bubu-debug-mode', newMode.toString());
  }, [globalDebugMode]);

  // 下载数据功能
  const handleExportData = useCallback(async (message: ConversationMessage) => {
    try {
      // 尝试从调试信息中获取生成的SQL查询
      let sqlQuery = '';
      if (message.debugInfo?.llm_raw_response) {
        // 使用LLM原始响应作为SQL查询
        sqlQuery = typeof message.debugInfo.llm_raw_response === 'string' 
          ? message.debugInfo.llm_raw_response 
          : JSON.stringify(message.debugInfo.llm_raw_response);
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

  // 全局键盘快捷键支持
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框上，完全不处理，让输入框自己处理所有快捷键
      if (document.activeElement === textareaRef.current) {
        return;
      }
      
      // ESC: 关闭模态框或取消操作
      if (isEscapePressed(e)) {
        // 如果有模态框打开，关闭它们
        if (showTemplates) {
          setShowTemplates?.(false);
          e.preventDefault();
        }
      }
    };
    
    // 添加全局键盘事件监听
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [showTemplates, setShowTemplates]);

  const handleSubmit = () => {
    if (input.trim() && !loading) {
      onQuery(input.trim());
      setInput('');
    }
  };

  // 使用原生DOM事件处理回车键，避免React事件系统的干扰
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const handleNativeKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      // 对于所有其他按键，完全不处理，让浏览器原生处理
    };
    
    textarea.addEventListener('keydown', handleNativeKeyDown);
    
    return () => {
      textarea.removeEventListener('keydown', handleNativeKeyDown);
    };
  }, [input]); // 依赖input以确保handleSubmit能获取到最新的值



  // 生成文件名显示文本
  const getFileDisplayText = () => {
    if (selectedFiles.length === 0) return '未选择文件';
    if (selectedFiles.length === 1) {
      const filename = selectedFiles[0].filename;
      return filename.length > 20 ? `${filename.substring(0, 17)}...` : filename;
    }
    return `${selectedFiles.length}个文件`;
  };

  return (
    <div className="flex flex-col h-full bg-base-100">
      {/* 固定的Header头部 */}
      <div className="sticky top-0 z-20 bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-lg">💬</div>
          <div>
            <h2 className="text-base font-medium text-base-content">{getFileDisplayText()}</h2>
            {selectedFiles.length > 1 && (
              <p className="text-xs text-base-content/60">
                {selectedFiles.map(f => f.filename.length > 15 ? `${f.filename.substring(0, 12)}...` : f.filename).join(', ')}
              </p>
            )}
          </div>
        </div>
        
        {/* 调试按钮 */}
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
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6">
        <div className="max-w-4xl mx-auto w-full">
        {conversations.length === 0 ? (
          <WelcomeScreen />
        ) : (
          // 对话消息列表
          conversations.map((message) => (
            <ConversationMessageComponent 
              key={message.id} 
              message={message} 
              onSuggestionClick={onSuggestionClick}
              globalDebugMode={globalDebugMode}
              onExport={handleExportData}
            />
          ))
        )}
        
        {/* 加载状态 */}
        {loading && <LoadingMessage />}
        
        <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 智能建议界面 */}
      {showTemplates && (
        <TemplatePanel
          templates={templates || []}
          showTemplates={showTemplates}
          onClose={() => setShowTemplates?.(false)}
          onUseTemplate={(templateId, promptText) => {
            onUseTemplate?.(templateId);
            setInput(promptText);
          }}
          onDeleteTemplate={(templateId) => onDeleteTemplate?.(templateId)}
        />
      )}
      
      {/* 输入区域 */}
      <InputArea
        input={input}
        setInput={setInput}
        loading={loading}
        onSubmit={handleSubmit}
        templatesCount={templates?.length || 0}
        showTemplates={showTemplates}
        onToggleTemplates={() => setShowTemplates?.(!showTemplates)}
      />
    </div>
  );
};

// ConversationMessage 组件已移至独立文件

// SimpleDataTable 组件已移至独立文件

export default ConversationInterface;