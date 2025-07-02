import React, { useRef, useEffect } from 'react';
import { UI_CONSTANTS, STYLE_CLASSES } from '../constants/ui';
import { isEnterPressed } from '../utils/keyboard';

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
  templatesCount: number;
  showTemplates: boolean;
  onToggleTemplates: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  loading,
  onSubmit,
  templatesCount,
  showTemplates,
  onToggleTemplates
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight, 
        UI_CONSTANTS.INPUT.MAX_HEIGHT
      )}px`;
    }
  }, [input]);

  // 使用原生DOM事件处理回车键，避免React事件系统的干扰
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const handleNativeKeyDown = (e: KeyboardEvent) => {
      if (isEnterPressed(e)) {
        e.preventDefault();
        onSubmit();
      }
      // 对于所有其他按键，完全不处理，让浏览器原生处理
    };
    
    textarea.addEventListener('keydown', handleNativeKeyDown);
    
    return () => {
      textarea.removeEventListener('keydown', handleNativeKeyDown);
    };
  }, [onSubmit]);

  return (
    <div className="border-t border-base-300 p-4 lg:p-6 xl:p-8">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* 智能建议和功能按钮 */}
        <div className={STYLE_CLASSES.FLEX_BETWEEN + " mb-3"}>
          <div className={`flex ${STYLE_CLASSES.SPACE_X_2}`}>
            <button
              onClick={onToggleTemplates}
              className={`btn btn-sm ${
                showTemplates 
                  ? 'btn-primary' 
                  : 'btn-ghost'
              }`}
              title="智能建议"
            >
              {UI_CONSTANTS.TEMPLATES.BUTTON_ICON} 智能建议 ({templatesCount})
            </button>
          </div>
        </div>
        
        <div className={`flex ${STYLE_CLASSES.SPACE_X_3}`}>
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={UI_CONSTANTS.INPUT.PLACEHOLDER}
              className={STYLE_CLASSES.INPUT_BASE + " text-fluid-base"}
              style={{ 
                userSelect: 'text',
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text'
              }}
              rows={1}
              disabled={loading}
              spellCheck={true}
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </div>
          
          <SubmitButton 
            loading={loading}
            disabled={!input.trim()}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
};

// 提交按钮组件
interface SubmitButtonProps {
  loading: boolean;
  disabled: boolean;
  onSubmit: () => void;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({
  loading,
  disabled,
  onSubmit
}) => (
  <button
    onClick={onSubmit}
    disabled={loading || disabled}
    className="px-4 lg:px-6 py-3 lg:py-4 bg-primary text-primary-content rounded-lg hover:bg-primary-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 text-fluid-base"
  >
    {loading ? (
      <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2}`}>
        <div className="loading loading-spinner loading-sm"></div>
        <span className="hidden sm:inline">分析中</span>
      </div>
    ) : (
      <span>发送</span>
    )}
  </button>
);

export default InputArea;