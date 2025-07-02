// 键盘事件处理工具函数

/**
 * 检查是否按下了 Ctrl 或 Cmd 键（跨平台兼容）
 * @param event 键盘事件
 * @returns boolean
 */
export const isModifierKeyPressed = (event: KeyboardEvent): boolean => {
  return event.ctrlKey || event.metaKey;
};

/**
 * 检查是否按下了特定的快捷键组合
 * @param event 键盘事件
 * @param key 目标按键
 * @param withModifier 是否需要修饰键（Ctrl/Cmd）
 * @returns boolean
 */
export const isShortcutPressed = (
  event: KeyboardEvent,
  key: string,
  withModifier: boolean = false
): boolean => {
  if (withModifier) {
    return isModifierKeyPressed(event) && event.key.toLowerCase() === key.toLowerCase();
  }
  return event.key === key;
};

/**
 * 检查是否按下了回车键（不包含Shift）
 * @param event 键盘事件
 * @returns boolean
 */
export const isEnterPressed = (event: KeyboardEvent): boolean => {
  return event.key === 'Enter' && !event.shiftKey;
};

/**
 * 检查是否按下了Shift+Enter组合键
 * @param event 键盘事件
 * @returns boolean
 */
export const isShiftEnterPressed = (event: KeyboardEvent): boolean => {
  return event.key === 'Enter' && event.shiftKey;
};

/**
 * 检查是否按下了ESC键
 * @param event 键盘事件
 * @returns boolean
 */
export const isEscapePressed = (event: KeyboardEvent): boolean => {
  return event.key === 'Escape';
};

/**
 * 创建键盘事件处理器
 * @param handlers 事件处理器映射
 * @returns 键盘事件处理函数
 */
export const createKeyboardHandler = (handlers: {
  onEnter?: () => void;
  onShiftEnter?: () => void;
  onEscape?: () => void;
  onCtrlA?: () => void;
  onCtrlC?: () => void;
  onCtrlV?: () => void;
  onCtrlZ?: () => void;
}) => {
  return (event: KeyboardEvent) => {
    // Enter键处理
    if (isEnterPressed(event) && handlers.onEnter) {
      event.preventDefault();
      handlers.onEnter();
      return;
    }
    
    // Shift+Enter键处理
    if (isShiftEnterPressed(event) && handlers.onShiftEnter) {
      handlers.onShiftEnter();
      return;
    }
    
    // ESC键处理
    if (isEscapePressed(event) && handlers.onEscape) {
      event.preventDefault();
      handlers.onEscape();
      return;
    }
    
    // Ctrl/Cmd快捷键处理
    if (isModifierKeyPressed(event)) {
      switch (event.key.toLowerCase()) {
        case 'a':
          if (handlers.onCtrlA) {
            handlers.onCtrlA();
          }
          break;
        case 'c':
          if (handlers.onCtrlC) {
            handlers.onCtrlC();
          }
          break;
        case 'v':
          if (handlers.onCtrlV) {
            handlers.onCtrlV();
          }
          break;
        case 'z':
          if (handlers.onCtrlZ) {
            handlers.onCtrlZ();
          }
          break;
      }
    }
  };
};

/**
 * 防止事件冒泡的工具函数
 * @param event 事件对象
 */
export const stopPropagation = (event: Event) => {
  event.stopPropagation();
};

/**
 * 阻止默认行为的工具函数
 * @param event 事件对象
 */
export const preventDefault = (event: Event) => {
  event.preventDefault();
};

/**
 * 同时阻止默认行为和事件冒泡
 * @param event 事件对象
 */
export const stopEvent = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};