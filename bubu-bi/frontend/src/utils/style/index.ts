/**
 * 样式工具函数
 * 提供 CSS 类名处理、主题管理和响应式设计功能
 */

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  colors: {
    primary: Record<string, string>;
    secondary: Record<string, string>;
    success: Record<string, string>;
    warning: Record<string, string>;
    error: Record<string, string>;
    neutral: Record<string, string>;
    background: Record<string, string>;
    text: Record<string, string>;
  };
  spacing: Record<string, string>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  };
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
  zIndex: Record<string, number>;
}

/**
 * 响应式断点
 */
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * 默认主题配置
 */
export const defaultTheme: ThemeConfig = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
      inverse: '#ffffff',
    },
  },
  spacing: {
    0: '0px',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
  },
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
    },
    fontWeight: {
      thin: '100',
      extralight: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
  },
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: '0 0 #0000',
  },
  breakpoints,
  zIndex: {
    auto: 0,
    base: 1,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
    toast: 1070,
    overlay: 1080,
  },
};

/**
 * 类名工具函数
 */
export const classNames = {
  /**
   * 合并类名
   */
  merge: (...classes: (string | undefined | null | false)[]): string => {
    return classes.filter(Boolean).join(' ');
  },

  /**
   * 条件类名
   */
  conditional: (condition: boolean, trueClass: string, falseClass = ''): string => {
    return condition ? trueClass : falseClass;
  },

  /**
   * 对象形式的类名
   */
  object: (classMap: Record<string, boolean>): string => {
    return Object.entries(classMap)
      .filter(([, condition]) => condition)
      .map(([className]) => className)
      .join(' ');
  },

  /**
   * 变体类名生成器
   */
  variant: (
    base: string,
    variants: Record<string, Record<string, string>>,
    props: Record<string, string>
  ): string => {
    const classes = [base];
    
    for (const [key, value] of Object.entries(props)) {
      if (variants[key] && variants[key][value]) {
        classes.push(variants[key][value]);
      }
    }
    
    return classes.join(' ');
  },
};

/**
 * CSS 变量工具
 */
export const cssVars = {
  /**
   * 设置 CSS 变量
   */
  set: (element: HTMLElement, vars: Record<string, string | number>): void => {
    for (const [key, value] of Object.entries(vars)) {
      element.style.setProperty(`--${key}`, String(value));
    }
  },

  /**
   * 获取 CSS 变量
   */
  get: (element: HTMLElement, varName: string): string => {
    return getComputedStyle(element).getPropertyValue(`--${varName}`).trim();
  },

  /**
   * 移除 CSS 变量
   */
  remove: (element: HTMLElement, varNames: string[]): void => {
    for (const varName of varNames) {
      element.style.removeProperty(`--${varName}`);
    }
  },

  /**
   * 生成主题 CSS 变量
   */
  generateThemeVars: (theme: ThemeConfig): Record<string, string> => {
    const vars: Record<string, string> = {};
    
    // 颜色变量
    for (const [colorType, colors] of Object.entries(theme.colors)) {
      if (typeof colors === 'object') {
        for (const [shade, value] of Object.entries(colors)) {
          vars[`color-${colorType}-${shade}`] = value;
        }
      }
    }
    
    // 间距变量
    for (const [key, value] of Object.entries(theme.spacing)) {
      vars[`spacing-${key}`] = value;
    }
    
    // 字体变量
    for (const [type, values] of Object.entries(theme.typography)) {
      for (const [key, value] of Object.entries(values)) {
        vars[`${type}-${key}`] = value;
      }
    }
    
    // 圆角变量
    for (const [key, value] of Object.entries(theme.borderRadius)) {
      vars[`radius-${key}`] = value;
    }
    
    // 阴影变量
    for (const [key, value] of Object.entries(theme.shadows)) {
      vars[`shadow-${key}`] = value;
    }
    
    // 断点变量
    for (const [key, value] of Object.entries(theme.breakpoints)) {
      vars[`breakpoint-${key}`] = value;
    }
    
    // z-index 变量
    for (const [key, value] of Object.entries(theme.zIndex)) {
      vars[`z-${key}`] = String(value);
    }
    
    return vars;
  },
};

/**
 * 响应式工具
 */
export const responsive = {
  /**
   * 媒体查询生成器
   */
  mediaQuery: (breakpoint: keyof typeof breakpoints, type: 'min' | 'max' = 'min'): string => {
    const value = breakpoints[breakpoint];
    return `@media (${type}-width: ${value})`;
  },

  /**
   * 响应式值选择器
   */
  getValue: <T>(
    values: Partial<Record<keyof typeof breakpoints, T>>,
    currentBreakpoint: keyof typeof breakpoints
  ): T | undefined => {
    const orderedBreakpoints: (keyof typeof breakpoints)[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = orderedBreakpoints.indexOf(currentBreakpoint);
    
    // 从当前断点向下查找值
    for (let i = currentIndex; i >= 0; i--) {
      const bp = orderedBreakpoints[i];
      if (values[bp] !== undefined) {
        return values[bp];
      }
    }
    
    return undefined;
  },

  /**
   * 检测当前断点
   */
  getCurrentBreakpoint: (): keyof typeof breakpoints => {
    if (typeof window === 'undefined') return 'lg';
    
    const width = window.innerWidth;
    
    if (width >= parseInt(breakpoints['2xl'])) return '2xl';
    if (width >= parseInt(breakpoints.xl)) return 'xl';
    if (width >= parseInt(breakpoints.lg)) return 'lg';
    if (width >= parseInt(breakpoints.md)) return 'md';
    if (width >= parseInt(breakpoints.sm)) return 'sm';
    return 'xs';
  },
};

/**
 * 动画工具
 */
export const animations = {
  /**
   * 缓动函数
   */
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  /**
   * 持续时间
   */
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },

  /**
   * 创建过渡
   */
  transition: (
    property: string | string[],
    duration = '300ms',
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
    delay = '0ms'
  ): string => {
    const properties = Array.isArray(property) ? property : [property];
    return properties
      .map(prop => `${prop} ${duration} ${easing} ${delay}`)
      .join(', ');
  },

  /**
   * 关键帧动画
   */
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    fadeOut: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    slideInUp: {
      from: { transform: 'translateY(100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideInDown: {
      from: { transform: 'translateY(-100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideInLeft: {
      from: { transform: 'translateX(-100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    slideInRight: {
      from: { transform: 'translateX(100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    scaleIn: {
      from: { transform: 'scale(0)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    scaleOut: {
      from: { transform: 'scale(1)', opacity: 1 },
      to: { transform: 'scale(0)', opacity: 0 },
    },
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
    bounce: {
      '0%, 20%, 53%, 80%, 100%': {
        transform: 'translate3d(0,0,0)',
      },
      '40%, 43%': {
        transform: 'translate3d(0, -30px, 0)',
      },
      '70%': {
        transform: 'translate3d(0, -15px, 0)',
      },
      '90%': {
        transform: 'translate3d(0, -4px, 0)',
      },
    },
  },
};

/**
 * 颜色工具
 */
export const colorUtils = {
  /**
   * 十六进制转 RGB
   */
  hexToRgb: (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  /**
   * RGB 转十六进制
   */
  rgbToHex: (r: number, g: number, b: number): string => {
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  },

  /**
   * 调整颜色亮度
   */
  adjustBrightness: (hex: string, percent: number): string => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return hex;
    
    const adjust = (value: number) => {
      const adjusted = Math.round(value * (1 + percent / 100));
      return Math.max(0, Math.min(255, adjusted));
    };
    
    return colorUtils.rgbToHex(
      adjust(rgb.r),
      adjust(rgb.g),
      adjust(rgb.b)
    );
  },

  /**
   * 获取对比色
   */
  getContrastColor: (hex: string): string => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return '#000000';
    
    // 计算亮度
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  },

  /**
   * 混合颜色
   */
  mixColors: (color1: string, color2: string, ratio = 0.5): string => {
    const rgb1 = colorUtils.hexToRgb(color1);
    const rgb2 = colorUtils.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return color1;
    
    const mix = (a: number, b: number) => Math.round(a * (1 - ratio) + b * ratio);
    
    return colorUtils.rgbToHex(
      mix(rgb1.r, rgb2.r),
      mix(rgb1.g, rgb2.g),
      mix(rgb1.b, rgb2.b)
    );
  },
};

/**
 * 布局工具
 */
export const layoutUtils = {
  /**
   * Flexbox 工具类生成器
   */
  flex: {
    center: 'display: flex; align-items: center; justify-content: center;',
    centerX: 'display: flex; justify-content: center;',
    centerY: 'display: flex; align-items: center;',
    between: 'display: flex; justify-content: space-between;',
    around: 'display: flex; justify-content: space-around;',
    evenly: 'display: flex; justify-content: space-evenly;',
    start: 'display: flex; justify-content: flex-start;',
    end: 'display: flex; justify-content: flex-end;',
    column: 'display: flex; flex-direction: column;',
    row: 'display: flex; flex-direction: row;',
    wrap: 'display: flex; flex-wrap: wrap;',
    nowrap: 'display: flex; flex-wrap: nowrap;',
  },

  /**
   * Grid 工具类生成器
   */
  grid: {
    center: 'display: grid; place-items: center;',
    cols: (n: number) => `display: grid; grid-template-columns: repeat(${n}, 1fr);`,
    rows: (n: number) => `display: grid; grid-template-rows: repeat(${n}, 1fr);`,
    gap: (size: string) => `gap: ${size};`,
    autoFit: (minSize: string) => `grid-template-columns: repeat(auto-fit, minmax(${minSize}, 1fr));`,
    autoFill: (minSize: string) => `grid-template-columns: repeat(auto-fill, minmax(${minSize}, 1fr));`,
  },

  /**
   * 位置工具
   */
  position: {
    absolute: 'position: absolute;',
    relative: 'position: relative;',
    fixed: 'position: fixed;',
    sticky: 'position: sticky;',
    center: 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);',
    centerX: 'position: absolute; left: 50%; transform: translateX(-50%);',
    centerY: 'position: absolute; top: 50%; transform: translateY(-50%);',
    fullscreen: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
  },

  /**
   * 尺寸工具
   */
  size: {
    full: 'width: 100%; height: 100%;',
    screen: 'width: 100vw; height: 100vh;',
    square: (size: string) => `width: ${size}; height: ${size};`,
    circle: (size: string) => `width: ${size}; height: ${size}; border-radius: 50%;`,
    aspectRatio: (ratio: string) => `aspect-ratio: ${ratio};`,
  },
};

/**
 * 导出所有样式工具
 */
export const styleUtils = {
  defaultTheme,
  breakpoints,
  classNames,
  cssVars,
  responsive,
  animations,
  colorUtils,
  layoutUtils,
};

export default styleUtils;