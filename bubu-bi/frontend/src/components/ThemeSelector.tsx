import React, { useState } from 'react';
import { useTheme, DaisyTheme, ThemeConfig } from '../hooks/useTheme';

export interface ThemeSelectorProps {
  /** 显示模式 */
  mode?: 'dropdown' | 'grid' | 'list';
  /** 是否显示主题预览 */
  showPreview?: boolean;
  /** 是否显示主题描述 */
  showDescription?: boolean;
  /** 是否按分类分组显示 */
  groupByCategory?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 触发器文本 */
  triggerText?: string;
  /** 是否显示当前主题名称 */
  showCurrentTheme?: boolean;
}

/**
 * 主题选择器组件
 * 提供多种显示模式的主题切换界面
 */
export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  mode = 'dropdown',
  showPreview = true,
  showDescription = false,
  groupByCategory = true,
  className = '',
  triggerText = '主题',
  showCurrentTheme = true,
}) => {
  const {
    currentTheme,
    themeConfig,
    availableThemes,
    themesByCategory,
    setTheme,
    isDarkTheme,
  } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<DaisyTheme | null>(null);

  // 处理主题选择
  const handleThemeSelect = (theme: DaisyTheme) => {
    setTheme(theme);
    setIsOpen(false);
    setPreviewTheme(null);
  };

  // 处理主题预览
  const handleThemePreview = (theme: DaisyTheme | null) => {
    if (showPreview) {
      setPreviewTheme(theme);
    }
  };

  // 渲染主题预览色块
  const renderThemePreview = (config: ThemeConfig) => {
    if (!showPreview) return null;

    return (
      <div className="flex gap-1 mr-2">
        <div 
          className="w-3 h-3 rounded-full border border-base-300"
          style={{ backgroundColor: config.preview.primary }}
        />
        <div 
          className="w-3 h-3 rounded-full border border-base-300"
          style={{ backgroundColor: config.preview.secondary }}
        />
        <div 
          className="w-3 h-3 rounded-full border border-base-300"
          style={{ backgroundColor: config.preview.accent }}
        />
      </div>
    );
  };

  // 渲染主题项
  const renderThemeItem = (config: ThemeConfig, isActive: boolean = false) => (
    <button
      key={config.name}
      className={`
        flex items-center w-full p-3 text-left transition-colors
        hover:bg-base-200 focus:bg-base-200 focus:outline-none
        ${isActive ? 'bg-primary/10 text-primary' : ''}
      `}
      onClick={() => handleThemeSelect(config.name)}
      onMouseEnter={() => handleThemePreview(config.name)}
      onMouseLeave={() => handleThemePreview(null)}
    >
      {renderThemePreview(config)}
      <div className="flex-1">
        <div className="font-medium">{config.displayName}</div>
        {showDescription && (
          <div className="text-sm opacity-60 mt-1">{config.description}</div>
        )}
      </div>
      {isActive && (
        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  // 渲染分组主题列表
  const renderGroupedThemes = () => {
    const categoryNames = {
      light: '浅色主题',
      dark: '深色主题',
      colorful: '彩色主题',
      minimal: '简约主题',
    };

    return Object.entries(themesByCategory).map(([category, themes]) => (
      <div key={category} className="mb-4">
        <div className="px-3 py-2 text-sm font-medium text-base-content/60 border-b border-base-300">
          {categoryNames[category as keyof typeof categoryNames]}
        </div>
        <div className="space-y-1">
          {themes.map(config => 
            renderThemeItem(config, config.name === currentTheme)
          )}
        </div>
      </div>
    ));
  };

  // 渲染普通主题列表
  const renderThemeList = () => (
    <div className="space-y-1">
      {availableThemes.map(config => 
        renderThemeItem(config, config.name === currentTheme)
      )}
    </div>
  );

  // 下拉模式
  if (mode === 'dropdown') {
    return (
      <div className={`dropdown dropdown-end ${isOpen ? 'dropdown-open' : ''} ${className}`}>
        <button
          className="btn btn-ghost gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {showPreview && renderThemePreview(themeConfig)}
          <span>
            {triggerText}
            {showCurrentTheme && (
              <span className="ml-1 opacity-60">({themeConfig.displayName})</span>
            )}
          </span>
          <svg 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="dropdown-content z-[1] menu p-0 shadow-lg bg-base-100 rounded-box w-80 max-h-96 overflow-y-auto border border-base-300">
            <div className="p-3 border-b border-base-300">
              <h3 className="font-medium">选择主题</h3>
              <p className="text-sm opacity-60 mt-1">选择您喜欢的界面主题</p>
            </div>
            
            <div className="p-2">
              {groupByCategory ? renderGroupedThemes() : renderThemeList()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 网格模式
  if (mode === 'grid') {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-medium">选择主题</h3>
        
        {groupByCategory ? (
          Object.entries(themesByCategory).map(([category, themes]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-sm font-medium text-base-content/60 uppercase tracking-wide">
                {{
                  light: '浅色主题',
                  dark: '深色主题',
                  colorful: '彩色主题',
                  minimal: '简约主题',
                }[category as keyof typeof themesByCategory]}
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {themes.map(config => (
                  <button
                    key={config.name}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      hover:shadow-md focus:outline-none focus:shadow-md
                      ${config.name === currentTheme 
                        ? 'border-primary bg-primary/5' 
                        : 'border-base-300 hover:border-base-400'
                      }
                    `}
                    onClick={() => handleThemeSelect(config.name)}
                    onMouseEnter={() => handleThemePreview(config.name)}
                    onMouseLeave={() => handleThemePreview(null)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {renderThemePreview(config)}
                      {config.name === currentTheme && (
                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="font-medium text-sm">{config.displayName}</div>
                    {showDescription && (
                      <div className="text-xs opacity-60 mt-1">{config.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableThemes.map(config => (
              <button
                key={config.name}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  hover:shadow-md focus:outline-none focus:shadow-md
                  ${config.name === currentTheme 
                    ? 'border-primary bg-primary/5' 
                    : 'border-base-300 hover:border-base-400'
                  }
                `}
                onClick={() => handleThemeSelect(config.name)}
                onMouseEnter={() => handleThemePreview(config.name)}
                onMouseLeave={() => handleThemePreview(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  {renderThemePreview(config)}
                  {config.name === currentTheme && (
                    <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                
                <div className="font-medium text-sm">{config.displayName}</div>
                {showDescription && (
                  <div className="text-xs opacity-60 mt-1">{config.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 列表模式
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-medium">选择主题</h3>
      
      <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
        {groupByCategory ? renderGroupedThemes() : renderThemeList()}
      </div>
    </div>
  );
};

// 快速主题切换按钮组件
export interface QuickThemeSwitcherProps {
  /** 自定义样式类名 */
  className?: string;
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示主题名称 */
  showName?: boolean;
}

/**
 * 快速主题切换器
 * 提供简单的主题切换按钮
 */
export const QuickThemeSwitcher: React.FC<QuickThemeSwitcherProps> = ({
  className = '',
  size = 'md',
  showName = false,
}) => {
  const { currentTheme, themeConfig, nextTheme, isDarkTheme } = useTheme();

  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  return (
    <button
      className={`btn btn-ghost ${sizeClasses[size]} gap-2 ${className}`}
      onClick={nextTheme}
      title={`当前主题: ${themeConfig.displayName}`}
    >
      {/* 主题图标 */}
      {isDarkTheme ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      )}
      
      {showName && (
        <span className="hidden sm:inline">{themeConfig.displayName}</span>
      )}
    </button>
  );
};

export default ThemeSelector;