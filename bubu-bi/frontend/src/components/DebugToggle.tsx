import React from 'react';
import { UI_CONSTANTS } from '../constants/ui';

interface DebugToggleProps {
  debugMode: boolean;
  onToggle: () => void;
}

export const DebugToggle: React.FC<DebugToggleProps> = ({
  debugMode,
  onToggle
}) => {
  return (
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={onToggle}
        className={`px-3 py-1 text-xs rounded-full transition-colors ${
          debugMode 
            ? 'bg-warning text-warning-content' 
            : 'bg-base-300 text-base-content/60 hover:bg-base-200'
        }`}
        title={debugMode ? '关闭调试模式' : '开启调试模式'}
      >
        {debugMode ? `${UI_CONSTANTS.ICONS.DEBUG} 调试模式` : UI_CONSTANTS.ICONS.DEBUG}
      </button>
    </div>
  );
};

export default DebugToggle;