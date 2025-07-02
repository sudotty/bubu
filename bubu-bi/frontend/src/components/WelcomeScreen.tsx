import React from 'react';
import { UI_CONSTANTS } from '../constants/ui';

export const WelcomeScreen: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">{UI_CONSTANTS.ICONS.ROBOT}</div>
        <h2 className="text-fluid-2xl font-bold text-base-content mb-2">
          BuBu AI 助手
        </h2>
        <p className="text-fluid-base text-base-content/60 mb-6">
          用自然语言描述你想了解的数据，我来帮你分析
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;