import React, { useState } from 'react';
import { useI18n, SupportedLanguage, LanguageConfig } from '../hooks/useI18n';

export interface LanguageSelectorProps {
  /** 显示模式 */
  mode?: 'dropdown' | 'list' | 'compact';
  /** 是否显示语言标志 */
  showFlag?: boolean;
  /** 是否显示原生名称 */
  showNativeName?: boolean;
  /** 是否显示英文名称 */
  showEnglishName?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 触发器文本 */
  triggerText?: string;
  /** 是否显示当前语言 */
  showCurrentLanguage?: boolean;
}

/**
 * 语言选择器组件
 * 提供多种显示模式的语言切换界面
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  mode = 'dropdown',
  showFlag = true,
  showNativeName = true,
  showEnglishName = false,
  className = '',
  triggerText,
  showCurrentLanguage = true,
}) => {
  const {
    currentLanguage,
    languageConfig,
    availableLanguages,
    setLanguage,
    isLoading,
    t,
  } = useI18n();

  const [isOpen, setIsOpen] = useState(false);

  // 处理语言选择
  const handleLanguageSelect = (language: SupportedLanguage) => {
    setLanguage(language);
    setIsOpen(false);
  };

  // 渲染语言项
  const renderLanguageItem = (config: LanguageConfig, isActive: boolean = false) => (
    <button
      key={config.code}
      className={`
        flex items-center w-full p-3 text-left transition-colors
        hover:bg-base-200 focus:bg-base-200 focus:outline-none
        ${isActive ? 'bg-primary/10 text-primary' : ''}
      `}
      onClick={() => handleLanguageSelect(config.code)}
    >
      {showFlag && (
        <span className="text-lg mr-3">{config.flag}</span>
      )}
      
      <div className="flex-1">
        {showNativeName && (
          <div className="font-medium">{config.nativeName}</div>
        )}
        {showEnglishName && (
          <div className="text-sm opacity-60 mt-1">{config.name}</div>
        )}
      </div>
      
      {isActive && (
        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  // 渲染语言列表
  const renderLanguageList = () => (
    <div className="space-y-1">
      {availableLanguages.map(config => 
        renderLanguageItem(config, config.code === currentLanguage)
      )}
    </div>
  );

  // 获取触发器文本
  const getTriggerText = () => {
    if (triggerText) return triggerText;
    return t('language.language');
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="loading loading-spinner loading-sm"></div>
        <span className="text-sm opacity-60">{t('common.loading')}</span>
      </div>
    );
  }

  // 下拉模式
  if (mode === 'dropdown') {
    return (
      <div className={`dropdown dropdown-end ${isOpen ? 'dropdown-open' : ''} ${className}`}>
        <button
          className="btn btn-ghost gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {showFlag && (
            <span className="text-lg">{languageConfig.flag}</span>
          )}
          
          <span>
            {getTriggerText()}
            {showCurrentLanguage && (
              <span className="ml-1 opacity-60">({languageConfig.nativeName})</span>
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
          <div className="dropdown-content z-[1] menu p-0 shadow-lg bg-base-100 rounded-box w-64 border border-base-300">
            <div className="p-3 border-b border-base-300">
              <h3 className="font-medium">{t('language.selectLanguage')}</h3>
              <p className="text-sm opacity-60 mt-1">{t('language.currentLanguage')}: {languageConfig.nativeName}</p>
            </div>
            
            <div className="p-2">
              {renderLanguageList()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 紧凑模式
  if (mode === 'compact') {
    return (
      <div className={`dropdown dropdown-end ${isOpen ? 'dropdown-open' : ''} ${className}`}>
        <button
          className="btn btn-ghost btn-sm gap-1"
          onClick={() => setIsOpen(!isOpen)}
          title={`${t('language.currentLanguage')}: ${languageConfig.nativeName}`}
        >
          <span className="text-base">{languageConfig.flag}</span>
          <span className="text-xs">{languageConfig.code.split('-')[0].toUpperCase()}</span>
        </button>
        
        {isOpen && (
          <div className="dropdown-content z-[1] menu p-0 shadow-lg bg-base-100 rounded-box w-48 border border-base-300">
            <div className="p-2">
              {availableLanguages.map(config => (
                <button
                  key={config.code}
                  className={`
                    flex items-center w-full p-2 text-left transition-colors rounded
                    hover:bg-base-200 focus:bg-base-200 focus:outline-none
                    ${config.code === currentLanguage ? 'bg-primary/10 text-primary' : ''}
                  `}
                  onClick={() => handleLanguageSelect(config.code)}
                >
                  <span className="text-base mr-2">{config.flag}</span>
                  <span className="text-sm font-medium">{config.nativeName}</span>
                  {config.code === currentLanguage && (
                    <svg className="w-3 h-3 ml-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 列表模式
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-medium">{t('language.selectLanguage')}</h3>
      
      <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
        {renderLanguageList()}
      </div>
    </div>
  );
};

// 快速语言切换按钮组件
export interface QuickLanguageSwitcherProps {
  /** 自定义样式类名 */
  className?: string;
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示语言名称 */
  showName?: boolean;
}

/**
 * 快速语言切换器
 * 提供简单的语言切换按钮
 */
export const QuickLanguageSwitcher: React.FC<QuickLanguageSwitcherProps> = ({
  className = '',
  size = 'md',
  showName = false,
}) => {
  const {
    currentLanguage,
    languageConfig,
    availableLanguages,
    setLanguage,
    isLoading,
  } = useI18n();

  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  // 切换到下一个语言
  const switchToNextLanguage = () => {
    const currentIndex = availableLanguages.findIndex(lang => lang.code === currentLanguage);
    const nextIndex = (currentIndex + 1) % availableLanguages.length;
    setLanguage(availableLanguages[nextIndex].code);
  };

  if (isLoading) {
    return (
      <button className={`btn btn-ghost ${sizeClasses[size]} ${className}`} disabled>
        <div className="loading loading-spinner loading-sm"></div>
      </button>
    );
  }

  return (
    <button
      className={`btn btn-ghost ${sizeClasses[size]} gap-2 ${className}`}
      onClick={switchToNextLanguage}
      title={`当前语言: ${languageConfig.nativeName}`}
    >
      {/* 语言标志 */}
      <span className="text-lg">{languageConfig.flag}</span>
      
      {showName && (
        <span className="hidden sm:inline">{languageConfig.nativeName}</span>
      )}
    </button>
  );
};

export default LanguageSelector;