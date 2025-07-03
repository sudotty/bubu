// React 19 国际化 Hook - 轻量级实现
import { useMemo } from 'react';
import type { TableI18nTexts } from '../types/table';

// 默认语言包
const DEFAULT_TEXTS: Record<string, TableI18nTexts> = {
  'zh-CN': {
    totalRows: '共 {count} 行数据',
    clearSort: '清除排序',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    noData: '暂无数据',
    loading: '加载中...',
    error: '加载失败',
    sortAscending: '升序排列',
    sortDescending: '降序排列',
  },
  'en-US': {
    totalRows: 'Total {count} rows',
    clearSort: 'Clear Sort',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    noData: 'No Data',
    loading: 'Loading...',
    error: 'Load Failed',
    sortAscending: 'Sort Ascending',
    sortDescending: 'Sort Descending',
  },
  'ja-JP': {
    totalRows: '合計 {count} 行',
    clearSort: 'ソートをクリア',
    fullscreen: 'フルスクリーン',
    exitFullscreen: 'フルスクリーン終了',
    noData: 'データなし',
    loading: '読み込み中...',
    error: '読み込み失敗',
    sortAscending: '昇順',
    sortDescending: '降順',
  },
};

// 语言检测函数
const detectLanguage = (): string => {
  if (typeof navigator !== 'undefined') {
    return navigator.language || 'en-US';
  }
  return 'en-US';
};

// 文本插值函数
const interpolate = (template: string, params: Record<string, string | number>): string => {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key]?.toString() || match;
  });
};

// 国际化 Hook
export const useTableI18n = (customTexts?: Partial<TableI18nTexts>, locale?: string) => {
  const currentLocale = locale || detectLanguage();
  
  const texts = useMemo(() => {
    const baseTexts = DEFAULT_TEXTS[currentLocale] || DEFAULT_TEXTS['en-US'];
    return { ...baseTexts, ...customTexts };
  }, [currentLocale, customTexts]);

  const t = useMemo(() => {
    return (key: keyof TableI18nTexts, params?: Record<string, string | number>): string => {
      const text = texts[key];
      return params ? interpolate(text, params) : text;
    };
  }, [texts]);

  return { t, locale: currentLocale, texts };
};

// 导出类型和默认值
export { DEFAULT_TEXTS, type TableI18nTexts };