import React, { memo } from 'react';
import type { FileInfo } from '../types';
import { formatFileSize, formatDate } from '../utils/fileUtils';

interface FileCardProps {
  file: FileInfo;
  isSelected?: boolean;
  onSelect?: () => void;
  isProcessing?: boolean;
}

const FileCard = memo(({
  file,
  isSelected = false,
  onSelect,
  isProcessing = false
}: FileCardProps) => {

  const handleClick = () => {
    onSelect?.();
  };

  return (
    <div 
      className={`card p-3 cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/20' 
          : 'bg-base-100 border-base-300 hover:shadow-md hover:border-primary/30'
      } ${
        isProcessing 
          ? 'animate-pulse bg-primary/5 border-primary/50' 
          : ''
      } shadow-sm border`}
      onClick={handleClick}
      title="点击选择/取消选择文件"
    >
      <div className="flex items-center space-x-3">
        <div className={`text-2xl transition-transform duration-200 ${
          isSelected ? 'scale-110' : ''
        }`}>
          {file.file_type === 'xlsx' ? '📊' : '📄'}
        </div>
        <div className="flex-1">
          <div className={`font-medium text-sm transition-colors duration-200 ${
            isSelected ? 'text-primary' : ''
          }`}>
            {file.filename}
          </div>
          <div className="text-xs text-base-content/60">
            {formatFileSize(file.file_size)} • {formatDate(file.upload_time)}
          </div>
        </div>
        
        {/* 选中状态指示器 */}
        {isSelected && (
          <div className="flex items-center space-x-1">
            {isProcessing && (
              <div className="loading loading-spinner loading-xs text-primary"></div>
            )}
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
      
      {/* 处理状态提示 */}
      {isProcessing && (
        <div className="mt-2 text-xs text-primary font-medium flex items-center space-x-1">
          <span>🔄</span>
          <span>正在处理此文件数据...</span>
        </div>
      )}
    </div>
  );
});

FileCard.displayName = 'FileCard';

export default FileCard;