import { useState, useEffect, useCallback } from 'react';

// DaisyUI 内置主题列表
export const DAISY_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
] as const;

export type DaisyTheme = typeof DAISY_THEMES[number];

// 主题配置接口
export interface ThemeConfig {
  name: DaisyTheme;
  displayName: string;
  description: string;
  category: 'light' | 'dark' | 'colorful' | 'minimal';
  preview: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    base: string;
  };
}

// 主题分类配置
export const THEME_CONFIGS: Record<DaisyTheme, ThemeConfig> = {
  light: {
    name: 'light',
    displayName: '浅色主题',
    description: '经典的浅色主题，适合日间使用',
    category: 'light',
    preview: {
      primary: '#570df8',
      secondary: '#f000b8',
      accent: '#37cdbe',
      neutral: '#3d4451',
      base: '#ffffff',
    },
  },
  dark: {
    name: 'dark',
    displayName: '深色主题',
    description: '经典的深色主题，适合夜间使用',
    category: 'dark',
    preview: {
      primary: '#661ae6',
      secondary: '#d926aa',
      accent: '#1fb2a5',
      neutral: '#191d24',
      base: '#2a303c',
    },
  },
  cupcake: {
    name: 'cupcake',
    displayName: '纸杯蛋糕',
    description: '温馨可爱的粉色主题',
    category: 'colorful',
    preview: {
      primary: '#65c3c8',
      secondary: '#ef9fbc',
      accent: '#eeaf3a',
      neutral: '#291334',
      base: '#faf7f5',
    },
  },
  bumblebee: {
    name: 'bumblebee',
    displayName: '大黄蜂',
    description: '活力四射的黄色主题',
    category: 'colorful',
    preview: {
      primary: '#e0a82e',
      secondary: '#f9d72f',
      accent: '#181830',
      neutral: '#181830',
      base: '#ffffff',
    },
  },
  emerald: {
    name: 'emerald',
    displayName: '翡翠绿',
    description: '清新自然的绿色主题',
    category: 'colorful',
    preview: {
      primary: '#66cc8a',
      secondary: '#377cfb',
      accent: '#ea5234',
      neutral: '#333c4d',
      base: '#ffffff',
    },
  },
  corporate: {
    name: 'corporate',
    displayName: '商务风',
    description: '专业的商务风格主题',
    category: 'minimal',
    preview: {
      primary: '#4b6bfb',
      secondary: '#7b92b2',
      accent: '#67cba0',
      neutral: '#181a2a',
      base: '#ffffff',
    },
  },
  synthwave: {
    name: 'synthwave',
    displayName: '合成波',
    description: '复古未来主义风格',
    category: 'dark',
    preview: {
      primary: '#e779c1',
      secondary: '#58c7f3',
      accent: '#f3cc30',
      neutral: '#20134e',
      base: '#1d1536',
    },
  },
  retro: {
    name: 'retro',
    displayName: '复古风',
    description: '怀旧的复古色彩主题',
    category: 'colorful',
    preview: {
      primary: '#ef9995',
      secondary: '#a4cbb4',
      accent: '#dc8850',
      neutral: '#2e282a',
      base: '#ece3ca',
    },
  },
  cyberpunk: {
    name: 'cyberpunk',
    displayName: '赛博朋克',
    description: '未来科技感的霓虹主题',
    category: 'dark',
    preview: {
      primary: '#ff7598',
      secondary: '#75d1f0',
      accent: '#c07eec',
      neutral: '#1e2124',
      base: '#0d1117',
    },
  },
  valentine: {
    name: 'valentine',
    displayName: '情人节',
    description: '浪漫的粉红色主题',
    category: 'colorful',
    preview: {
      primary: '#e96d7b',
      secondary: '#a991f7',
      accent: '#88dbdd',
      neutral: '#af4670',
      base: '#f0d6e8',
    },
  },
  halloween: {
    name: 'halloween',
    displayName: '万圣节',
    description: '神秘的橙黑配色主题',
    category: 'dark',
    preview: {
      primary: '#f28c18',
      secondary: '#6d3a9c',
      accent: '#51a800',
      neutral: '#1b1d1d',
      base: '#212121',
    },
  },
  garden: {
    name: 'garden',
    displayName: '花园',
    description: '清新的绿色花园主题',
    category: 'light',
    preview: {
      primary: '#5c7f67',
      secondary: '#ecf4e7',
      accent: '#fae5e5',
      neutral: '#5d5656',
      base: '#e8f5e8',
    },
  },
  forest: {
    name: 'forest',
    displayName: '森林',
    description: '深邃的森林绿主题',
    category: 'dark',
    preview: {
      primary: '#1eb854',
      secondary: '#1fd65f',
      accent: '#1db584',
      neutral: '#19362d',
      base: '#171212',
    },
  },
  aqua: {
    name: 'aqua',
    displayName: '水蓝',
    description: '清澈的水蓝色主题',
    category: 'light',
    preview: {
      primary: '#09ecf3',
      secondary: '#966fb3',
      accent: '#ffe999',
      neutral: '#3b8ac4',
      base: '#345da7',
    },
  },
  lofi: {
    name: 'lofi',
    displayName: 'Lo-Fi',
    description: '低保真复古风格',
    category: 'minimal',
    preview: {
      primary: '#0d0d0d',
      secondary: '#1a1a1a',
      accent: '#262626',
      neutral: '#0d0d0d',
      base: '#fafafa',
    },
  },
  pastel: {
    name: 'pastel',
    displayName: '马卡龙',
    description: '柔和的马卡龙色彩',
    category: 'light',
    preview: {
      primary: '#d1c1d7',
      secondary: '#f6cbd1',
      accent: '#b4e9d1',
      neutral: '#70acc7',
      base: '#ffffff',
    },
  },
  fantasy: {
    name: 'fantasy',
    displayName: '幻想',
    description: '梦幻的紫色主题',
    category: 'colorful',
    preview: {
      primary: '#6e0b75',
      secondary: '#a21caf',
      accent: '#c148ac',
      neutral: '#371547',
      base: '#ffffff',
    },
  },
  wireframe: {
    name: 'wireframe',
    displayName: '线框',
    description: '简约的线框风格',
    category: 'minimal',
    preview: {
      primary: '#b8b8b8',
      secondary: '#b8b8b8',
      accent: '#b8b8b8',
      neutral: '#b8b8b8',
      base: '#ffffff',
    },
  },
  black: {
    name: 'black',
    displayName: '纯黑',
    description: '极简的纯黑主题',
    category: 'dark',
    preview: {
      primary: '#343232',
      secondary: '#343232',
      accent: '#343232',
      neutral: '#2a2e37',
      base: '#000000',
    },
  },
  luxury: {
    name: 'luxury',
    displayName: '奢华',
    description: '高端奢华的金色主题',
    category: 'dark',
    preview: {
      primary: '#ffffff',
      secondary: '#152747',
      accent: '#513448',
      neutral: '#152747',
      base: '#09090b',
    },
  },
  dracula: {
    name: 'dracula',
    displayName: '德古拉',
    description: '经典的德古拉配色',
    category: 'dark',
    preview: {
      primary: '#ff79c6',
      secondary: '#bd93f9',
      accent: '#ffb86c',
      neutral: '#414558',
      base: '#282a36',
    },
  },
  cmyk: {
    name: 'cmyk',
    displayName: 'CMYK',
    description: '印刷色彩模式主题',
    category: 'colorful',
    preview: {
      primary: '#45aeee',
      secondary: '#e8488a',
      accent: '#ffc832',
      neutral: '#2a2e37',
      base: '#ffffff',
    },
  },
  autumn: {
    name: 'autumn',
    displayName: '秋日',
    description: '温暖的秋日色彩',
    category: 'colorful',
    preview: {
      primary: '#8c0327',
      secondary: '#d85251',
      accent: '#d59b6a',
      neutral: '#826a5c',
      base: '#f1f1f0',
    },
  },
  business: {
    name: 'business',
    displayName: '商务',
    description: '专业的商务主题',
    category: 'minimal',
    preview: {
      primary: '#1c4ed8',
      secondary: '#7c2d12',
      accent: '#dc2626',
      neutral: '#1f2937',
      base: '#ffffff',
    },
  },
  acid: {
    name: 'acid',
    displayName: '酸性',
    description: '鲜艳的酸性色彩',
    category: 'colorful',
    preview: {
      primary: '#ff00ff',
      secondary: '#ff7300',
      accent: '#00ffff',
      neutral: '#1f1f23',
      base: '#fafafa',
    },
  },
  lemonade: {
    name: 'lemonade',
    displayName: '柠檬水',
    description: '清新的柠檬黄主题',
    category: 'light',
    preview: {
      primary: '#519903',
      secondary: '#e9e92f',
      accent: '#ff8a00',
      neutral: '#1f2937',
      base: '#ffffff',
    },
  },
  night: {
    name: 'night',
    displayName: '夜晚',
    description: '深邃的夜晚主题',
    category: 'dark',
    preview: {
      primary: '#38bdf8',
      secondary: '#818cf8',
      accent: '#f471b5',
      neutral: '#1e293b',
      base: '#0f172a',
    },
  },
  coffee: {
    name: 'coffee',
    displayName: '咖啡',
    description: '温暖的咖啡色主题',
    category: 'dark',
    preview: {
      primary: '#db924b',
      secondary: '#263e3f',
      accent: '#10576d',
      neutral: '#120c12',
      base: '#20161f',
    },
  },
  winter: {
    name: 'winter',
    displayName: '冬日',
    description: '清冷的冬日主题',
    category: 'light',
    preview: {
      primary: '#047aed',
      secondary: '#463aa2',
      accent: '#c148ac',
      neutral: '#394e6a',
      base: '#ffffff',
    },
  },
};

// 主题Hook接口
export interface UseThemeReturn {
  // 当前主题
  currentTheme: DaisyTheme;
  // 主题配置
  themeConfig: ThemeConfig;
  // 所有可用主题
  availableThemes: ThemeConfig[];
  // 按分类分组的主题
  themesByCategory: Record<ThemeConfig['category'], ThemeConfig[]>;
  // 切换主题
  setTheme: (theme: DaisyTheme) => void;
  // 切换到下一个主题
  nextTheme: () => void;
  // 切换到上一个主题
  prevTheme: () => void;
  // 重置为默认主题
  resetTheme: () => void;
  // 是否为深色主题
  isDarkTheme: boolean;
  // 获取主题预览色彩
  getThemePreview: (theme: DaisyTheme) => ThemeConfig['preview'];
}

// 默认主题
const DEFAULT_THEME: DaisyTheme = 'light';

// 本地存储键名
const THEME_STORAGE_KEY = 'bubu-bi-theme';

/**
 * 主题管理Hook
 * 提供完整的DaisyUI主题管理功能
 */
export const useTheme = (): UseThemeReturn => {
  // 从localStorage读取保存的主题，如果没有则使用默认主题
  const [currentTheme, setCurrentTheme] = useState<DaisyTheme>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && DAISY_THEMES.includes(savedTheme as DaisyTheme)) {
      return savedTheme as DaisyTheme;
    }
    return DEFAULT_THEME;
  });

  // 获取当前主题配置
  const themeConfig = THEME_CONFIGS[currentTheme];

  // 获取所有可用主题配置
  const availableThemes = DAISY_THEMES.map(theme => THEME_CONFIGS[theme]);

  // 按分类分组主题
  const themesByCategory = availableThemes.reduce((acc, theme) => {
    if (!acc[theme.category]) {
      acc[theme.category] = [];
    }
    acc[theme.category].push(theme);
    return acc;
  }, {} as Record<ThemeConfig['category'], ThemeConfig[]>);

  // 判断是否为深色主题
  const isDarkTheme = themeConfig.category === 'dark';

  // 应用主题到DOM
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 设置HTML元素的data-theme属性
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // 保存到localStorage
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    
    // 触发主题变更事件
    const event = new CustomEvent('themeChange', {
      detail: { theme: currentTheme, config: themeConfig }
    });
    window.dispatchEvent(event);
  }, [currentTheme, themeConfig]);

  // 切换主题
  const setTheme = useCallback((theme: DaisyTheme) => {
    if (DAISY_THEMES.includes(theme)) {
      setCurrentTheme(theme);
    } else {
      console.warn(`Invalid theme: ${theme}. Using default theme instead.`);
      setCurrentTheme(DEFAULT_THEME);
    }
  }, []);

  // 切换到下一个主题
  const nextTheme = useCallback(() => {
    const currentIndex = DAISY_THEMES.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % DAISY_THEMES.length;
    setTheme(DAISY_THEMES[nextIndex]);
  }, [currentTheme, setTheme]);

  // 切换到上一个主题
  const prevTheme = useCallback(() => {
    const currentIndex = DAISY_THEMES.indexOf(currentTheme);
    const prevIndex = currentIndex === 0 ? DAISY_THEMES.length - 1 : currentIndex - 1;
    setTheme(DAISY_THEMES[prevIndex]);
  }, [currentTheme, setTheme]);

  // 重置为默认主题
  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME);
  }, [setTheme]);

  // 获取主题预览色彩
  const getThemePreview = useCallback((theme: DaisyTheme) => {
    return THEME_CONFIGS[theme]?.preview || THEME_CONFIGS[DEFAULT_THEME].preview;
  }, []);

  return {
    currentTheme,
    themeConfig,
    availableThemes,
    themesByCategory,
    setTheme,
    nextTheme,
    prevTheme,
    resetTheme,
    isDarkTheme,
    getThemePreview,
  };
};

export default useTheme;