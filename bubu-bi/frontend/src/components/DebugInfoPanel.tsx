import React, { useState } from 'react';
import { copyDebugInfo } from '../utils/clipboard';
import { DebugInfo } from '../types/debug';

interface DebugInfoPanelProps {
  debugInfo: DebugInfo;
  onClose?: () => void;
}

export const DebugInfoPanel: React.FC<DebugInfoPanelProps> = ({
  debugInfo,
  onClose
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-yellow-700 dark:text-yellow-300 flex items-center">
          <span className="mr-2">🐛</span>
          调试信息
        </h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 text-sm transition-colors"
            title={isExpanded ? "收起" : "展开"}
          >
            {isExpanded ? "▲" : "▼"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 text-sm transition-colors"
              title="关闭调试信息"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="space-y-3 text-sm">
          {/* 模型信息 */}
          {debugInfo.model_used && (
            <DebugInfoItem
              label="模型"
              value={debugInfo.model_used}
              className="text-gray-700 dark:text-gray-300"
            />
          )}
          
          {/* API端点 */}
          {debugInfo.api_endpoint && (
            <DebugInfoItem
              label="API端点"
              value={debugInfo.api_endpoint}
              className="text-gray-700 dark:text-gray-300 font-mono text-xs"
            />
          )}
          
          {/* 处理时间 */}
          {debugInfo.processing_time && (
            <DebugInfoItem
              label="处理时间"
              value={`${debugInfo.processing_time}ms`}
              className="text-gray-700 dark:text-gray-300"
            />
          )}
          
          {/* 原始Prompt */}
          {debugInfo.original_prompt && (
            <DebugCodeBlock
              label="原始Prompt"
              content={debugInfo.original_prompt}
              onCopy={() => copyDebugInfo(debugInfo, 'prompt')}
              className="bg-gray-50 dark:bg-gray-800"
            />
          )}
          
          {/* 系统Prompt */}
          {debugInfo.system_prompt && (
            <DebugCodeBlock
              label="系统Prompt"
              content={debugInfo.system_prompt}
              onCopy={() => navigator.clipboard.writeText(debugInfo.system_prompt || '')}
              className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/30"
              labelClassName="text-blue-700 dark:text-blue-300"
            />
          )}
          
          {/* 用户Prompt */}
          {debugInfo.user_prompt && (
            <DebugCodeBlock
              label="用户Prompt"
              content={debugInfo.user_prompt}
              onCopy={() => navigator.clipboard.writeText(debugInfo.user_prompt || '')}
              className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/30"
              labelClassName="text-green-700 dark:text-green-300"
            />
          )}
          
          {/* LLM原始响应 */}
          {debugInfo.llm_raw_response && (
            <DebugCodeBlock
              label="LLM原始响应"
              content={typeof debugInfo.llm_raw_response === 'string' ? debugInfo.llm_raw_response : JSON.stringify(debugInfo.llm_raw_response, null, 2)}
              onCopy={() => navigator.clipboard.writeText(typeof debugInfo.llm_raw_response === 'string' ? debugInfo.llm_raw_response : JSON.stringify(debugInfo.llm_raw_response, null, 2))}
              className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/30"
              labelClassName="text-purple-700 dark:text-purple-300"
            />
          )}
        </div>
      )}
    </div>
  );
};

// 调试信息项组件
interface DebugInfoItemProps {
  label: string;
  value: string;
  className?: string;
}

const DebugInfoItem: React.FC<DebugInfoItemProps> = ({
  label,
  value,
  className = ''
}) => (
  <div>
    <span className="font-medium text-yellow-700 dark:text-yellow-300">{label}:</span>
    <span className={`ml-2 ${className}`}>{value}</span>
  </div>
);

// 调试代码块组件
interface DebugCodeBlockProps {
  label: string;
  content: string;
  onCopy: () => void;
  className?: string;
  labelClassName?: string;
}

const DebugCodeBlock: React.FC<DebugCodeBlockProps> = ({
  label,
  content,
  onCopy,
  className = '',
  labelClassName = 'text-yellow-700 dark:text-yellow-300'
}) => (
  <div>
    <div className="flex items-center justify-between">
      <span className={`font-medium ${labelClassName}`}>{label}:</span>
      <button
        onClick={onCopy}
        className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${labelClassName}`}
        title={`复制${label}`}
      >
        📋
      </button>
    </div>
    <div className={`mt-1 p-2 rounded border text-xs font-mono max-h-32 overflow-y-auto ${className}`}>
      <pre 
        className="whitespace-pre-wrap select-text" 
        style={{ userSelect: 'text' }}
      >
        {content}
      </pre>
    </div>
  </div>
);

export default DebugInfoPanel;