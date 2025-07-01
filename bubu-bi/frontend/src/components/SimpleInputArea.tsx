import React, { useRef, useEffect } from 'react';

interface SimpleInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export const SimpleInputArea: React.FC<SimpleInputAreaProps> = ({
  value,
  onChange,
  onSubmit,
  loading = false,
  placeholder = "请输入您的问题..."
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading) {
        onSubmit(value.trim());
      }
    }
  };
  
  return (
    <div className="input-container border-t bg-base-100 p-4">
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            className="w-full p-3 border border-base-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-base-100"
            rows={1}
            disabled={loading}
          />
          <div className="mt-1 text-xs text-base-content/50">
            按 Enter 发送，Shift + Enter 换行
          </div>
        </div>
        <button
          onClick={() => onSubmit(value.trim())}
          disabled={loading || !value.trim()}
          className="px-6 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="loading loading-spinner loading-sm"></div>
              <span>处理中</span>
            </div>
          ) : (
            '发送'
          )}
        </button>
      </div>
    </div>
  );
};

export default SimpleInputArea;