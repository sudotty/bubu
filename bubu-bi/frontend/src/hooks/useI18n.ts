import { useState, useEffect, useCallback } from 'react';

// 支持的语言类型
export type SupportedLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja';

// 语言配置接口
export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
}

// 翻译键的类型定义
export interface TranslationKeys {
  // 通用
  common: {
    loading: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    confirm: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    refresh: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    clear: string;
    select: string;
    selectAll: string;
    deselectAll: string;
    noData: string;
    noResults: string;
    total: string;
    page: string;
    of: string;
    items: string;
    perPage: string;
  };
  
  // 表格相关
  table: {
    columns: string;
    rows: string;
    sort: string;
    sortAsc: string;
    sortDesc: string;
    filter: string;
    search: string;
    export: string;
    settings: string;
    density: string;
    compact: string;
    comfortable: string;
    spacious: string;
    showColumns: string;
    hideColumns: string;
    resetColumns: string;
    noData: string;
    loading: string;
    error: string;
    selected: string;
    selectAll: string;
    deselectAll: string;
    actions: string;
    bulkActions: string;
    deleteSelected: string;
    exportSelected: string;
    rowsPerPage: string;
    page: string;
    of: string;
    firstPage: string;
    lastPage: string;
    nextPage: string;
    previousPage: string;
    goto: string;
    totalRows: string;
  };
  
  // 主题相关
  theme: {
    theme: string;
    selectTheme: string;
    lightThemes: string;
    darkThemes: string;
    colorfulThemes: string;
    minimalThemes: string;
    currentTheme: string;
    switchTheme: string;
    themePreview: string;
    auto: string;
    light: string;
    dark: string;
    system: string;
  };
  
  // 语言相关
  language: {
    language: string;
    selectLanguage: string;
    currentLanguage: string;
    switchLanguage: string;
  };
  
  // 错误消息
  errors: {
    networkError: string;
    serverError: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    validationError: string;
    unknownError: string;
  };
  
  // 成功消息
  success: {
    saved: string;
    deleted: string;
    updated: string;
    created: string;
    imported: string;
    exported: string;
  };
}

// 支持的语言配置
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr',
  },
  'zh-TW': {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    flag: '🇹🇼',
    direction: 'ltr',
  },
  'en': {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
  },
};

// 默认语言
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// 本地存储键
const LANGUAGE_STORAGE_KEY = 'bubu-bi-language';

// 翻译资源类型
type TranslationResources = Record<SupportedLanguage, TranslationKeys>;

// 翻译资源（这里只定义结构，实际内容在单独的文件中）
let translationResources: TranslationResources | null = null;

// 动态加载翻译资源
const loadTranslations = async (language: SupportedLanguage): Promise<TranslationKeys> => {
  try {
    // 动态导入翻译文件
    const module = await import(`../locales/${language}.ts`);
    return module.default || module.translations;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}, falling back to default`);
    // 如果加载失败，尝试加载默认语言
    if (language !== DEFAULT_LANGUAGE) {
      return loadTranslations(DEFAULT_LANGUAGE);
    }
    // 如果默认语言也加载失败，返回空对象
    return {} as TranslationKeys;
  }
};

// 初始化翻译资源
const initializeTranslations = async () => {
  if (translationResources) return;
  
  const resources: Partial<TranslationResources> = {};
  
  // 并行加载所有语言的翻译
  await Promise.all(
    Object.keys(SUPPORTED_LANGUAGES).map(async (lang) => {
      const language = lang as SupportedLanguage;
      try {
        resources[language] = await loadTranslations(language);
      } catch (error) {
        console.warn(`Failed to load ${language} translations:`, error);
      }
    })
  );
  
  translationResources = resources as TranslationResources;
};

// 获取浏览器语言
const getBrowserLanguage = (): SupportedLanguage => {
  const browserLang = navigator.language || navigator.languages?.[0] || DEFAULT_LANGUAGE;
  
  // 精确匹配
  if (browserLang in SUPPORTED_LANGUAGES) {
    return browserLang as SupportedLanguage;
  }
  
  // 语言代码匹配（如 'zh' 匹配 'zh-CN'）
  const langCode = browserLang.split('-')[0];
  const matchedLang = Object.keys(SUPPORTED_LANGUAGES).find(lang => 
    lang.startsWith(langCode)
  );
  
  return (matchedLang as SupportedLanguage) || DEFAULT_LANGUAGE;
};

// 获取嵌套对象的值
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((current, key) => current?.[key], obj) || path;
};

/**
 * 国际化 Hook
 * 提供多语言支持功能
 */
export const useI18n = () => {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(() => {
    // 从本地存储获取保存的语言，如果没有则使用浏览器语言
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage;
    return savedLanguage && savedLanguage in SUPPORTED_LANGUAGES 
      ? savedLanguage 
      : getBrowserLanguage();
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [translations, setTranslations] = useState<TranslationKeys | null>(null);

  // 初始化翻译资源
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await initializeTranslations();
      
      if (translationResources?.[currentLanguage]) {
        setTranslations(translationResources[currentLanguage]);
      }
      
      setIsLoading(false);
    };
    
    init();
  }, []);

  // 当语言变化时更新翻译
  useEffect(() => {
    if (translationResources?.[currentLanguage]) {
      setTranslations(translationResources[currentLanguage]);
    }
  }, [currentLanguage]);

  // 切换语言
  const setLanguage = useCallback((language: SupportedLanguage) => {
    if (language in SUPPORTED_LANGUAGES) {
      setCurrentLanguage(language);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      
      // 设置 HTML lang 属性
      document.documentElement.lang = language;
      
      // 设置文档方向
      document.documentElement.dir = SUPPORTED_LANGUAGES[language].direction;
    }
  }, []);

  // 翻译函数
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (!translations) return key;
    
    let translation = getNestedValue(translations, key);
    
    // 如果找不到翻译，返回键名
    if (!translation || translation === key) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    
    // 参数替换
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(
          new RegExp(`{{${paramKey}}}`, 'g'), 
          String(value)
        );
      });
    }
    
    return translation;
  }, [translations]);

  // 获取当前语言配置
  const languageConfig = SUPPORTED_LANGUAGES[currentLanguage];
  
  // 获取所有可用语言
  const availableLanguages = Object.values(SUPPORTED_LANGUAGES);
  
  // 检查是否为 RTL 语言
  const isRTL = languageConfig.direction === 'rtl';
  
  // 格式化数字
  const formatNumber = useCallback((number: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(currentLanguage, options).format(number);
  }, [currentLanguage]);
  
  // 格式化日期
  const formatDate = useCallback((date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return new Intl.DateTimeFormat(currentLanguage, options).format(dateObj);
  }, [currentLanguage]);
  
  // 格式化相对时间
  const formatRelativeTime = useCallback((value: number, unit: Intl.RelativeTimeFormatUnit) => {
    const rtf = new Intl.RelativeTimeFormat(currentLanguage, { numeric: 'auto' });
    return rtf.format(value, unit);
  }, [currentLanguage]);

  return {
    // 当前状态
    currentLanguage,
    languageConfig,
    isLoading,
    isRTL,
    
    // 可用语言
    availableLanguages,
    supportedLanguages: SUPPORTED_LANGUAGES,
    
    // 核心功能
    t,
    setLanguage,
    
    // 格式化功能
    formatNumber,
    formatDate,
    formatRelativeTime,
    
    // 便捷方法
    isLanguageSupported: (lang: string): lang is SupportedLanguage => 
      lang in SUPPORTED_LANGUAGES,
    
    // 获取翻译（不带参数替换）
    getTranslation: (key: string): string => 
      translations ? getNestedValue(translations, key) || key : key,
  };
};

export default useI18n;