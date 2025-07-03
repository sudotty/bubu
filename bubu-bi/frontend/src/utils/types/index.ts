/**
 * 类型工具函数
 * 提供类型检查、转换和验证功能
 */

/**
 * 基础类型检查工具
 */
export const typeCheckers = {
  /**
   * 检查是否为字符串
   */
  isString: (value: unknown): value is string => {
    return typeof value === 'string';
  },
  
  /**
   * 检查是否为数字
   */
  isNumber: (value: unknown): value is number => {
    return typeof value === 'number' && !isNaN(value);
  },
  
  /**
   * 检查是否为布尔值
   */
  isBoolean: (value: unknown): value is boolean => {
    return typeof value === 'boolean';
  },
  
  /**
   * 检查是否为函数
   */
  isFunction: (value: unknown): value is Function => {
    return typeof value === 'function';
  },
  
  /**
   * 检查是否为对象
   */
  isObject: (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  },
  
  /**
   * 检查是否为数组
   */
  isArray: <T = unknown>(value: unknown): value is T[] => {
    return Array.isArray(value);
  },
  
  /**
   * 检查是否为 null
   */
  isNull: (value: unknown): value is null => {
    return value === null;
  },
  
  /**
   * 检查是否为 undefined
   */
  isUndefined: (value: unknown): value is undefined => {
    return value === undefined;
  },
  
  /**
   * 检查是否为 null 或 undefined
   */
  isNullish: (value: unknown): value is null | undefined => {
    return value === null || value === undefined;
  },
  
  /**
   * 检查是否为空值（null、undefined、空字符串、空数组、空对象）
   */
  isEmpty: (value: unknown): boolean => {
    if (typeCheckers.isNullish(value)) return true;
    if (typeCheckers.isString(value)) return value.length === 0;
    if (typeCheckers.isArray(value)) return value.length === 0;
    if (typeCheckers.isObject(value)) return Object.keys(value).length === 0;
    return false;
  },
  
  /**
   * 检查是否为日期
   */
  isDate: (value: unknown): value is Date => {
    return value instanceof Date && !isNaN(value.getTime());
  },
  
  /**
   * 检查是否为正则表达式
   */
  isRegExp: (value: unknown): value is RegExp => {
    return value instanceof RegExp;
  },
  
  /**
   * 检查是否为 Promise
   */
  isPromise: <T = unknown>(value: unknown): value is Promise<T> => {
    return value instanceof Promise || (
      typeCheckers.isObject(value) &&
      typeCheckers.isFunction((value as any).then)
    );
  },
  
  /**
   * 检查是否为 Error
   */
  isError: (value: unknown): value is Error => {
    return value instanceof Error;
  }
};

/**
 * 类型转换工具
 */
export const typeConverters = {
  /**
   * 转换为字符串
   */
  toString: (value: unknown): string => {
    if (typeCheckers.isString(value)) return value;
    if (typeCheckers.isNullish(value)) return '';
    if (typeCheckers.isObject(value) || typeCheckers.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  },
  
  /**
   * 转换为数字
   */
  toNumber: (value: unknown): number => {
    if (typeCheckers.isNumber(value)) return value;
    if (typeCheckers.isString(value)) {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    }
    if (typeCheckers.isBoolean(value)) return value ? 1 : 0;
    return 0;
  },
  
  /**
   * 转换为布尔值
   */
  toBoolean: (value: unknown): boolean => {
    if (typeCheckers.isBoolean(value)) return value;
    if (typeCheckers.isNullish(value)) return false;
    if (typeCheckers.isString(value)) {
      return value.toLowerCase() === 'true' || value === '1';
    }
    if (typeCheckers.isNumber(value)) return value !== 0;
    return Boolean(value);
  },
  
  /**
   * 转换为数组
   */
  toArray: <T = unknown>(value: unknown): T[] => {
    if (typeCheckers.isArray<T>(value)) return value;
    if (typeCheckers.isNullish(value)) return [];
    return [value as T];
  },
  
  /**
   * 转换为对象
   */
  toObject: (value: unknown): Record<string, unknown> => {
    if (typeCheckers.isObject(value)) return value;
    if (typeCheckers.isString(value)) {
      try {
        const parsed = JSON.parse(value);
        return typeCheckers.isObject(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  },
  
  /**
   * 转换为日期
   */
  toDate: (value: unknown): Date | null => {
    if (typeCheckers.isDate(value)) return value;
    if (typeCheckers.isString(value) || typeCheckers.isNumber(value)) {
      const date = new Date(value);
      return typeCheckers.isDate(date) ? date : null;
    }
    return null;
  }
};

/**
 * 类型验证工具
 */
export const typeValidators = {
  /**
   * 验证邮箱格式
   */
  isEmail: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  /**
   * 验证 URL 格式
   */
  isUrl: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * 验证手机号格式（中国）
   */
  isPhoneNumber: (value: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value);
  },
  
  /**
   * 验证身份证号格式（中国）
   */
  isIdCard: (value: string): boolean => {
    const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return idCardRegex.test(value);
  },
  
  /**
   * 验证 IP 地址格式
   */
  isIpAddress: (value: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(value);
  },
  
  /**
   * 验证颜色值格式（HEX）
   */
  isHexColor: (value: string): boolean => {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(value);
  },
  
  /**
   * 验证数字范围
   */
  isInRange: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  },
  
  /**
   * 验证字符串长度
   */
  isLengthInRange: (value: string, min: number, max: number): boolean => {
    return value.length >= min && value.length <= max;
  },
  
  /**
   * 验证是否为正整数
   */
  isPositiveInteger: (value: number): boolean => {
    return Number.isInteger(value) && value > 0;
  },
  
  /**
   * 验证是否为非负整数
   */
  isNonNegativeInteger: (value: number): boolean => {
    return Number.isInteger(value) && value >= 0;
  }
};

/**
 * 深度类型工具
 */
export const deepTypeUtils = {
  /**
   * 深度克隆
   */
  deepClone: <T>(obj: T): T => {
    if (typeCheckers.isNullish(obj)) return obj;
    if (typeCheckers.isDate(obj)) return new Date(obj.getTime()) as T;
    if (typeCheckers.isRegExp(obj)) return new RegExp(obj) as T;
    if (typeCheckers.isArray(obj)) {
      return obj.map(item => deepTypeUtils.deepClone(item)) as T;
    }
    if (typeCheckers.isObject(obj)) {
      const cloned = {} as T;
      Object.keys(obj).forEach(key => {
        (cloned as any)[key] = deepTypeUtils.deepClone((obj as any)[key]);
      });
      return cloned;
    }
    return obj;
  },
  
  /**
   * 深度比较
   */
  deepEqual: (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeCheckers.isNullish(a) || typeCheckers.isNullish(b)) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeCheckers.isDate(a) && typeCheckers.isDate(b)) {
      return a.getTime() === b.getTime();
    }
    
    if (typeCheckers.isArray(a) && typeCheckers.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepTypeUtils.deepEqual(item, b[index]));
    }
    
    if (typeCheckers.isObject(a) && typeCheckers.isObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => 
        keysB.includes(key) && deepTypeUtils.deepEqual(a[key], b[key])
      );
    }
    
    return false;
  },
  
  /**
   * 深度合并
   */
  deepMerge: <T extends Record<string, any>>(...objects: Partial<T>[]): T => {
    const result = {} as Record<string, any>;
    
    objects.forEach(obj => {
      if (!typeCheckers.isObject(obj)) return;
      
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        if (typeCheckers.isObject(value) && typeCheckers.isObject(result[key])) {
          result[key] = deepTypeUtils.deepMerge(result[key], value);
        } else {
          result[key] = deepTypeUtils.deepClone(value);
        }
      });
    });
    
    return result as T;
  },
  
  /**
   * 获取嵌套属性值
   */
  getNestedValue: <T = unknown>(obj: Record<string, any>, path: string, defaultValue?: T): T => {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (!typeCheckers.isObject(current) || !(key in current)) {
        return defaultValue as T;
      }
      current = (current as Record<string, any>)[key];
    }
    
    return current as T;
  },
  
  /**
   * 设置嵌套属性值
   */
  setNestedValue: (obj: Record<string, any>, path: string, value: unknown): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;
    
    for (const key of keys) {
      if (!typeCheckers.isObject(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }
};

/**
 * 类型安全工具
 */
export const typeSafeUtils = {
  /**
   * 安全的 JSON 解析
   */
  safeJsonParse: <T = unknown>(json: string, defaultValue?: T): T | null => {
    try {
      return JSON.parse(json) as T;
    } catch {
      return defaultValue ?? null;
    }
  },
  
  /**
   * 安全的 JSON 字符串化
   */
  safeJsonStringify: (obj: unknown, defaultValue = '{}'): string => {
    try {
      return JSON.stringify(obj);
    } catch {
      return defaultValue;
    }
  },
  
  /**
   * 安全的属性访问
   */
  safeGet: <T = unknown>(obj: unknown, key: string, defaultValue?: T): T => {
    try {
      if (typeCheckers.isObject(obj)) {
        const value = obj[key];
        return value !== undefined ? value as T : defaultValue as T;
      }
      return defaultValue as T;
    } catch {
      return defaultValue as T;
    }
  },
  
  /**
   * 安全的函数调用
   */
  safeCall: <T = unknown>(fn: Function, ...args: unknown[]): T | null => {
    try {
      return fn(...args) as T;
    } catch {
      return null;
    }
  }
};

/**
 * 导出所有工具
 */
export const typeUtils = {
  ...typeCheckers,
  ...typeConverters,
  ...typeValidators,
  ...deepTypeUtils,
  ...typeSafeUtils
};

export default typeUtils;