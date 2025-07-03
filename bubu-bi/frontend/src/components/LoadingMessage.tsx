import React from 'react';
import { UI_CONSTANTS } from '../constants/ui';
// 已移除styles.ts，直接使用Tailwind CSS类名

export const LoadingMessage: React.FC = () => {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start space-x-2 max-w-[80%]">
        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm">
          {UI_CONSTANTS.ICONS.ROBOT}
        </div>
        <div className="bg-base-200 rounded-lg p-3 ml-2">
          <div className="flex items-center space-x-2">
            <div className="loading loading-dots loading-sm"></div>
            <span className="text-sm text-base-content/70">
              正在分析中...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingMessage;