/**
 * 表单工具函数
 * 提供表单验证、处理和状态管理功能
 */

/**
 * 验证规则类型
 */
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  number?: boolean;
  integer?: boolean;
  positive?: boolean;
  custom?: (value: any) => boolean | string;
  message?: string;
}

/**
 * 字段验证结果
 */
export interface FieldValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * 表单验证结果
 */
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string[]>;
  firstError?: string;
}

/**
 * 表单字段配置
 */
export interface FormField {
  name: string;
  label?: string;
  type?: string;
  defaultValue?: any;
  rules?: ValidationRule[];
  dependencies?: string[];
  transform?: (value: any) => any;
}

/**
 * 表单配置
 */
export interface FormConfig {
  fields: FormField[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  submitOnEnter?: boolean;
}

/**
 * 表单状态
 */
export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

/**
 * 验证工具函数
 */
export const validationUtils = {
  /**
   * 验证必填字段
   */
  required: (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  },

  /**
   * 验证最小值
   */
  min: (value: number, min: number): boolean => {
    return typeof value === 'number' && value >= min;
  },

  /**
   * 验证最大值
   */
  max: (value: number, max: number): boolean => {
    return typeof value === 'number' && value <= max;
  },

  /**
   * 验证最小长度
   */
  minLength: (value: string | any[], minLength: number): boolean => {
    return Boolean(value && value.length >= minLength);
  },

  /**
   * 验证最大长度
   */
  maxLength: (value: string | any[], maxLength: number): boolean => {
    return !value || value.length <= maxLength;
  },

  /**
   * 验证正则表达式
   */
  pattern: (value: string, pattern: RegExp): boolean => {
    return !value || pattern.test(value);
  },

  /**
   * 验证邮箱
   */
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !value || emailRegex.test(value);
  },

  /**
   * 验证 URL
   */
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return !value;
    }
  },

  /**
   * 验证数字
   */
  number: (value: any): boolean => {
    return value === '' || value === null || value === undefined || !isNaN(Number(value));
  },

  /**
   * 验证整数
   */
  integer: (value: any): boolean => {
    return value === '' || value === null || value === undefined || Number.isInteger(Number(value));
  },

  /**
   * 验证正数
   */
  positive: (value: number): boolean => {
    return typeof value === 'number' && value > 0;
  },
};

/**
 * 验证单个字段
 */
export const validateField = (value: any, rules: ValidationRule[] = []): FieldValidation => {
  const errors: string[] = [];

  for (const rule of rules) {
    let isValid = true;
    let errorMessage = rule.message || 'Validation failed';

    // 必填验证
    if (rule.required && !validationUtils.required(value)) {
      isValid = false;
      errorMessage = rule.message || 'This field is required';
    }
    // 最小值验证
    else if (rule.min !== undefined && !validationUtils.min(value, rule.min)) {
      isValid = false;
      errorMessage = rule.message || `Value must be at least ${rule.min}`;
    }
    // 最大值验证
    else if (rule.max !== undefined && !validationUtils.max(value, rule.max)) {
      isValid = false;
      errorMessage = rule.message || `Value must be at most ${rule.max}`;
    }
    // 最小长度验证
    else if (rule.minLength !== undefined && !validationUtils.minLength(value, rule.minLength)) {
      isValid = false;
      errorMessage = rule.message || `Must be at least ${rule.minLength} characters`;
    }
    // 最大长度验证
    else if (rule.maxLength !== undefined && !validationUtils.maxLength(value, rule.maxLength)) {
      isValid = false;
      errorMessage = rule.message || `Must be at most ${rule.maxLength} characters`;
    }
    // 正则表达式验证
    else if (rule.pattern && !validationUtils.pattern(value, rule.pattern)) {
      isValid = false;
      errorMessage = rule.message || 'Invalid format';
    }
    // 邮箱验证
    else if (rule.email && !validationUtils.email(value)) {
      isValid = false;
      errorMessage = rule.message || 'Invalid email address';
    }
    // URL 验证
    else if (rule.url && !validationUtils.url(value)) {
      isValid = false;
      errorMessage = rule.message || 'Invalid URL';
    }
    // 数字验证
    else if (rule.number && !validationUtils.number(value)) {
      isValid = false;
      errorMessage = rule.message || 'Must be a valid number';
    }
    // 整数验证
    else if (rule.integer && !validationUtils.integer(value)) {
      isValid = false;
      errorMessage = rule.message || 'Must be an integer';
    }
    // 正数验证
    else if (rule.positive && !validationUtils.positive(value)) {
      isValid = false;
      errorMessage = rule.message || 'Must be a positive number';
    }
    // 自定义验证
    else if (rule.custom) {
      const result = rule.custom(value);
      if (typeof result === 'string') {
        isValid = false;
        errorMessage = result;
      } else if (result === false) {
        isValid = false;
        errorMessage = rule.message || 'Custom validation failed';
      }
    }

    if (!isValid) {
      errors.push(errorMessage);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 验证整个表单
 */
export const validateForm = (
  values: Record<string, any>,
  fields: FormField[]
): FormValidation => {
  const errors: Record<string, string[]> = {};
  let firstError: string | undefined;

  for (const field of fields) {
    const value = values[field.name];
    const validation = validateField(value, field.rules);
    
    if (!validation.isValid) {
      errors[field.name] = validation.errors;
      if (!firstError) {
        firstError = validation.errors[0];
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstError,
  };
};

/**
 * 表单数据处理工具
 */
export const formUtils = {
  /**
   * 获取表单默认值
   */
  getDefaultValues: (fields: FormField[]): Record<string, any> => {
    const values: Record<string, any> = {};
    
    for (const field of fields) {
      values[field.name] = field.defaultValue ?? '';
    }
    
    return values;
  },

  /**
   * 重置表单状态
   */
  resetFormState: (fields: FormField[]): FormState => {
    const values = formUtils.getDefaultValues(fields);
    const fieldNames = fields.map(f => f.name);
    
    return {
      values,
      errors: {},
      touched: fieldNames.reduce((acc, name) => ({ ...acc, [name]: false }), {}),
      dirty: fieldNames.reduce((acc, name) => ({ ...acc, [name]: false }), {}),
      isSubmitting: false,
      isValid: true,
    };
  },

  /**
   * 更新字段值
   */
  updateFieldValue: (
    state: FormState,
    fieldName: string,
    value: any,
    field?: FormField
  ): Partial<FormState> => {
    // 应用字段转换
    const transformedValue = field?.transform ? field.transform(value) : value;
    
    const newValues = {
      ...state.values,
      [fieldName]: transformedValue,
    };

    const newDirty = {
      ...state.dirty,
      [fieldName]: true,
    };

    return {
      values: newValues,
      dirty: newDirty,
    };
  },

  /**
   * 标记字段为已触摸
   */
  touchField: (state: FormState, fieldName: string): Partial<FormState> => {
    return {
      touched: {
        ...state.touched,
        [fieldName]: true,
      },
    };
  },

  /**
   * 设置字段错误
   */
  setFieldErrors: (
    state: FormState,
    fieldName: string,
    errors: string[]
  ): Partial<FormState> => {
    const newErrors = {
      ...state.errors,
      [fieldName]: errors,
    };

    return {
      errors: newErrors,
      isValid: Object.values(newErrors).every(errs => errs.length === 0),
    };
  },

  /**
   * 清除字段错误
   */
  clearFieldErrors: (state: FormState, fieldName: string): Partial<FormState> => {
    const newErrors = { ...state.errors };
    delete newErrors[fieldName];

    return {
      errors: newErrors,
      isValid: Object.values(newErrors).every(errs => errs.length === 0),
    };
  },

  /**
   * 序列化表单数据
   */
  serializeForm: (values: Record<string, any>): FormData => {
    const formData = new FormData();
    
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && value !== undefined) {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            formData.append(`${key}[${index}]`, String(item));
          });
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    }
    
    return formData;
  },

  /**
   * 反序列化表单数据
   */
  deserializeForm: (formData: FormData): Record<string, any> => {
    const values: Record<string, any> = {};
    
    for (const [key, value] of formData.entries()) {
      if (key.includes('[') && key.includes(']')) {
        // 处理数组字段
        const baseKey = key.substring(0, key.indexOf('['));
        if (!values[baseKey]) {
          values[baseKey] = [];
        }
        values[baseKey].push(value);
      } else {
        // 尝试解析 JSON
        try {
          values[key] = JSON.parse(value as string);
        } catch {
          values[key] = value;
        }
      }
    }
    
    return values;
  },

  /**
   * 深度比较表单值
   */
  isFormDirty: (
    currentValues: Record<string, any>,
    initialValues: Record<string, any>
  ): boolean => {
    const keys = new Set([...Object.keys(currentValues), ...Object.keys(initialValues)]);
    
    for (const key of keys) {
      if (JSON.stringify(currentValues[key]) !== JSON.stringify(initialValues[key])) {
        return true;
      }
    }
    
    return false;
  },

  /**
   * 获取表单摘要
   */
  getFormSummary: (state: FormState): {
    totalFields: number;
    touchedFields: number;
    dirtyFields: number;
    errorFields: number;
    completionRate: number;
  } => {
    const totalFields = Object.keys(state.values).length;
    const touchedFields = Object.values(state.touched).filter(Boolean).length;
    const dirtyFields = Object.values(state.dirty).filter(Boolean).length;
    const errorFields = Object.keys(state.errors).length;
    const completionRate = totalFields > 0 ? (touchedFields / totalFields) * 100 : 0;

    return {
      totalFields,
      touchedFields,
      dirtyFields,
      errorFields,
      completionRate,
    };
  },
};

/**
 * 常用验证规则预设
 */
export const commonRules = {
  required: { required: true, message: 'This field is required' },
  email: { email: true, message: 'Please enter a valid email address' },
  url: { url: true, message: 'Please enter a valid URL' },
  number: { number: true, message: 'Please enter a valid number' },
  integer: { integer: true, message: 'Please enter a valid integer' },
  positive: { positive: true, message: 'Please enter a positive number' },
  
  minLength: (length: number) => ({
    minLength: length,
    message: `Must be at least ${length} characters`,
  }),
  
  maxLength: (length: number) => ({
    maxLength: length,
    message: `Must be at most ${length} characters`,
  }),
  
  min: (value: number) => ({
    min: value,
    message: `Value must be at least ${value}`,
  }),
  
  max: (value: number) => ({
    max: value,
    message: `Value must be at most ${value}`,
  }),
  
  pattern: (regex: RegExp, message = 'Invalid format') => ({
    pattern: regex,
    message,
  }),
  
  phone: {
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    message: 'Please enter a valid phone number',
  },
  
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must contain at least 8 characters with uppercase, lowercase, number and special character',
  },
};

/**
 * 导出所有表单工具
 */
export const formToolkit = {
  validationUtils,
  validateField,
  validateForm,
  formUtils,
  commonRules,
};

export default formToolkit;