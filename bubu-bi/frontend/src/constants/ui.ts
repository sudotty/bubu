// UI相关常量
export const UI_CONSTANTS = {
  // 数据表格
  TABLE: {
    VISIBLE_ROWS: 50,
    MAX_SORT_ROWS: 1000,
    PREVIEW_ROWS: 10,
  },
  
  // 动画时长
  ANIMATION: {
    TRANSITION_DURATION: 300,
    SCROLL_BEHAVIOR: 'smooth' as ScrollBehavior,
  },
  
  // 输入框
  INPUT: {
    MAX_HEIGHT: 120,
    PLACEHOLDER: '用自然语言描述你想了解的数据...',
  },
  
  // 调试模式
  DEBUG: {
    STORAGE_KEY: 'bubu-debug-mode',
    URL_PARAM: 'debug=true',
  },
  
  // 消息相关
  MESSAGE: {
    MAX_WIDTH_PERCENTAGE: '80%',
    COPY_SUCCESS_MESSAGE: '消息已复制到剪贴板',
    COPY_ERROR_MESSAGE: '复制失败',
  },
  
  // 智能建议
  TEMPLATES: {
    MAX_DISPLAY_HEIGHT: '15rem', // max-h-60
    EMPTY_STATE_ICON: '📝',
    BUTTON_ICON: '💡',
  },
  
  // 图标
  ICONS: {
    ROBOT: '🤖',
    USER: '👤',
    ERROR: '⚠️',
    DEBUG: '🔧',
    COPY: '📋',
    DELETE: '🗑️',
    EXPORT: '📥',
    FULLSCREEN: '🔍',
    CLOSE: '✕',
    INSIGHTS: '💡',
    TABLE: '📊',
    LOADING: '⏳',
  },
  
  // 响应式断点（与Tailwind保持一致）
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
  },
};

// 键盘快捷键
export const KEYBOARD_SHORTCUTS = {
  ENTER: 'Enter',
  SHIFT_ENTER: 'Shift+Enter',
  ESCAPE: 'Escape',
  CTRL_A: 'Ctrl+A',
  CMD_A: 'Cmd+A',
  CTRL_C: 'Ctrl+C',
  CMD_C: 'Cmd+C',
  CTRL_V: 'Ctrl+V',
  CMD_V: 'Cmd+V',
  CTRL_Z: 'Ctrl+Z',
  CMD_Z: 'Cmd+Z',
};

// 消息类型
export const MESSAGE_TYPES = {
  USER: 'user' as const,
  ASSISTANT: 'assistant' as const,
  ERROR: 'error' as const,
};

// 样式类名常量
export const STYLE_CLASSES = {
  // 布局
  FLEX_COL: 'flex flex-col',
  FLEX_ROW: 'flex flex-row',
  FLEX_CENTER: 'flex items-center justify-center',
  FLEX_BETWEEN: 'flex items-center justify-between',
  
  // 间距
  SPACE_X_2: 'space-x-2',
  SPACE_X_3: 'space-x-3',
  SPACE_Y_3: 'space-y-3',
  SPACE_Y_4: 'space-y-4',
  
  // 按钮
  BTN_PRIMARY: 'btn btn-primary',
  BTN_GHOST: 'btn btn-ghost',
  BTN_SM: 'btn btn-sm',
  BTN_XS: 'btn btn-xs',
  
  // 输入框
  INPUT_BASE: 'w-full p-3 lg:p-4 border border-base-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-base-100',
  
  // 卡片
  CARD_BASE: 'bg-base-100 rounded-lg border border-base-300',
  
  // 文本
  TEXT_MUTED: 'text-base-content/60',
  TEXT_SMALL: 'text-fluid-sm',
  TEXT_XS: 'text-fluid-xs',
};