import { ThemeConfig } from '../../types/data';

/**
 * 统一样式工具 - 合并了styles.ts的功能，并添加DaisyUI支持
 */

// DaisyUI主题映射
export const DAISYUI_THEMES = {
  light: 'light',
  dark: 'dark',
  cupcake: 'cupcake',
  bumblebee: 'bumblebee',
  emerald: 'emerald',
  corporate: 'corporate',
  synthwave: 'synthwave',
  retro: 'retro',
  cyberpunk: 'cyberpunk',
  valentine: 'valentine',
  halloween: 'halloween',
  garden: 'garden',
  forest: 'forest',
  aqua: 'aqua',
  lofi: 'lofi',
  pastel: 'pastel',
  fantasy: 'fantasy',
  wireframe: 'wireframe',
  black: 'black',
  luxury: 'luxury',
  dracula: 'dracula',
  cmyk: 'cmyk',
  autumn: 'autumn',
  business: 'business',
  acid: 'acid',
  lemonade: 'lemonade',
  night: 'night',
  coffee: 'coffee',
  winter: 'winter'
} as const;

export type DaisyUITheme = keyof typeof DAISYUI_THEMES;

// 主题管理
export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: DaisyUITheme = 'light';
  private observers: ((theme: DaisyUITheme) => void)[] = [];

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  setTheme(theme: DaisyUITheme): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.notifyObservers();
  }

  getTheme(): DaisyUITheme {
    return this.currentTheme;
  }

  initTheme(): void {
    const savedTheme = localStorage.getItem('theme') as DaisyUITheme;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme && savedTheme in DAISYUI_THEMES) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme(systemPrefersDark ? 'dark' : 'light');
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  subscribe(callback: (theme: DaisyUITheme) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(obs => obs !== callback);
    };
  }

  private notifyObservers(): void {
    this.observers.forEach(callback => callback(this.currentTheme));
  }
}

// CSS类名工具
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// DaisyUI组件类名生成器
export const daisyUI = {
  // 按钮样式
  button: {
    base: 'btn',
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    link: 'btn-link',
    info: 'btn-info',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error',
    outline: 'btn-outline',
    active: 'btn-active',
    disabled: 'btn-disabled',
    glass: 'btn-glass',
    loading: 'loading',
    wide: 'btn-wide',
    block: 'btn-block',
    circle: 'btn-circle',
    square: 'btn-square',
    sizes: {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg'
    }
  },

  // 输入框样式
  input: {
    base: 'input',
    bordered: 'input-bordered',
    ghost: 'input-ghost',
    primary: 'input-primary',
    secondary: 'input-secondary',
    accent: 'input-accent',
    info: 'input-info',
    success: 'input-success',
    warning: 'input-warning',
    error: 'input-error',
    sizes: {
      xs: 'input-xs',
      sm: 'input-sm',
      md: 'input-md',
      lg: 'input-lg'
    }
  },

  // 表格样式
  table: {
    base: 'table',
    zebra: 'table-zebra',
    pin: {
      rows: 'table-pin-rows',
      cols: 'table-pin-cols'
    },
    sizes: {
      xs: 'table-xs',
      sm: 'table-sm',
      md: 'table-md',
      lg: 'table-lg'
    }
  },

  // 卡片样式
  card: {
    base: 'card',
    bordered: 'card-bordered',
    imageFull: 'image-full',
    compact: 'card-compact',
    normal: 'card-normal',
    side: 'card-side',
    body: 'card-body',
    title: 'card-title',
    actions: 'card-actions'
  },

  // 模态框样式
  modal: {
    base: 'modal',
    open: 'modal-open',
    box: 'modal-box',
    action: 'modal-action',
    backdrop: 'modal-backdrop',
    toggle: 'modal-toggle',
    bottom: 'modal-bottom',
    middle: 'modal-middle'
  },

  // 加载样式
  loading: {
    base: 'loading',
    spinner: 'loading-spinner',
    dots: 'loading-dots',
    ring: 'loading-ring',
    ball: 'loading-ball',
    bars: 'loading-bars',
    infinity: 'loading-infinity',
    sizes: {
      xs: 'loading-xs',
      sm: 'loading-sm',
      md: 'loading-md',
      lg: 'loading-lg'
    }
  },

  // 徽章样式
  badge: {
    base: 'badge',
    neutral: 'badge-neutral',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    ghost: 'badge-ghost',
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    outline: 'badge-outline',
    sizes: {
      xs: 'badge-xs',
      sm: 'badge-sm',
      md: 'badge-md',
      lg: 'badge-lg'
    }
  },

  // 提示样式
  alert: {
    base: 'alert',
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error'
  },

  // 布局样式
  layout: {
    container: 'container',
    hero: 'hero',
    heroContent: 'hero-content',
    artboard: 'artboard',
    divider: 'divider',
    stack: 'stack',
    mockup: {
      phone: 'mockup-phone',
      browser: 'mockup-browser',
      window: 'mockup-window',
      code: 'mockup-code'
    }
  }
};

// 响应式工具
export const responsive = {
  // 断点
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },

  // 媒体查询生成器
  media: {
    sm: '@media (min-width: 640px)',
    md: '@media (min-width: 768px)',
    lg: '@media (min-width: 1024px)',
    xl: '@media (min-width: 1280px)',
    '2xl': '@media (min-width: 1536px)',
    mobile: '@media (max-width: 767px)',
    tablet: '@media (min-width: 768px) and (max-width: 1023px)',
    desktop: '@media (min-width: 1024px)'
  }
};

// 动画工具
export const animations = {
  // 过渡动画
  transition: {
    fast: 'transition-all duration-150 ease-in-out',
    normal: 'transition-all duration-300 ease-in-out',
    slow: 'transition-all duration-500 ease-in-out'
  },

  // 悬停效果
  hover: {
    scale: 'hover:scale-105 transform transition-transform',
    lift: 'hover:-translate-y-1 hover:shadow-lg transition-all',
    glow: 'hover:shadow-lg hover:shadow-primary/25 transition-shadow'
  },

  // 焦点效果
  focus: {
    ring: 'focus:ring-2 focus:ring-primary focus:ring-opacity-50',
    outline: 'focus:outline-none focus:ring-2 focus:ring-primary'
  }
};

// 间距工具
export const spacing = {
  // 内边距
  padding: {
    xs: 'p-1',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  },

  // 外边距
  margin: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-4',
    lg: 'm-6',
    xl: 'm-8'
  },

  // 间隙
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }
};

// 颜色工具
export const colors = {
  // 获取CSS变量颜色
  getCSSVar: (colorName: string): string => {
    return `hsl(var(--${colorName}))`;
  },

  // DaisyUI颜色变量
  primary: 'hsl(var(--p))',
  primaryContent: 'hsl(var(--pc))',
  secondary: 'hsl(var(--s))',
  secondaryContent: 'hsl(var(--sc))',
  accent: 'hsl(var(--a))',
  accentContent: 'hsl(var(--ac))',
  neutral: 'hsl(var(--n))',
  neutralContent: 'hsl(var(--nc))',
  base100: 'hsl(var(--b1))',
  base200: 'hsl(var(--b2))',
  base300: 'hsl(var(--b3))',
  baseContent: 'hsl(var(--bc))',
  info: 'hsl(var(--in))',
  infoContent: 'hsl(var(--inc))',
  success: 'hsl(var(--su))',
  successContent: 'hsl(var(--suc))',
  warning: 'hsl(var(--wa))',
  warningContent: 'hsl(var(--wac))',
  error: 'hsl(var(--er))',
  errorContent: 'hsl(var(--erc))'
};

// 工具函数
export const utils = {
  // 生成随机ID
  generateId: (): string => {
    return Math.random().toString(36).substr(2, 9);
  },

  // 防抖
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // 节流
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 深拷贝
  deepClone: <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => utils.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const clonedObj = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = utils.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  },

  // 格式化文件大小
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 格式化数字
  formatNumber: (num: number, locale: string = 'zh-CN'): string => {
    return new Intl.NumberFormat(locale).format(num);
  },

  // 截断文本
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
};

// 导出主题管理器实例
export const themeManager = ThemeManager.getInstance();