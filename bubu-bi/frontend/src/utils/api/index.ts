/**
 * API 工具函数
 * 提供 HTTP 请求、错误处理和数据获取功能
 */

/**
 * HTTP 方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * 请求配置接口
 */
export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cache?: boolean;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

/**
 * 响应接口
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  ok: boolean;
}

/**
 * 错误接口
 */
export interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  code?: string;
  details?: any;
}

/**
 * 请求拦截器类型
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * 响应拦截器类型
 */
export type ResponseInterceptor<T = any> = (response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;

/**
 * 错误拦截器类型
 */
export type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>;

/**
 * API 客户端类
 */
export class ApiClient {
  private baseURL: string;
  private defaultConfig: RequestConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(baseURL = '', defaultConfig: RequestConfig = {}) {
    this.baseURL = baseURL;
    this.defaultConfig = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      cache: false,
      credentials: 'same-origin',
      ...defaultConfig,
    };
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * 添加错误拦截器
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(url: string, config: RequestConfig): string {
    const method = config.method || 'GET';
    const body = config.body ? JSON.stringify(config.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * 检查缓存
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any, ttl = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 应用请求拦截器
   */
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let result = config;
    for (const interceptor of this.requestInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  /**
   * 应用响应拦截器
   */
  private async applyResponseInterceptors<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let result = response;
    for (const interceptor of this.responseInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  /**
   * 应用错误拦截器
   */
  private async applyErrorInterceptors(error: ApiError): Promise<ApiError> {
    let result = error;
    for (const interceptor of this.errorInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 发送请求
   */
  async request<T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // 应用请求拦截器
    const finalConfig = await this.applyRequestInterceptors(mergedConfig);
    
    // 检查缓存
    if (finalConfig.cache && finalConfig.method === 'GET') {
      const cacheKey = this.getCacheKey(fullUrl, finalConfig);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const { timeout, retries = 0, retryDelay = 1000, ...fetchConfig } = finalConfig;
    
    // 准备请求选项
    const requestOptions: RequestInit = {
      method: fetchConfig.method,
      headers: fetchConfig.headers,
      credentials: fetchConfig.credentials,
      signal: fetchConfig.signal,
    };

    // 处理请求体
    if (fetchConfig.body && fetchConfig.method !== 'GET') {
      if (typeof fetchConfig.body === 'object') {
        requestOptions.body = JSON.stringify(fetchConfig.body);
      } else {
        requestOptions.body = fetchConfig.body;
      }
    }

    let lastError: ApiError;
    
    // 重试逻辑
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // 构建响应对象
        let data: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else if (contentType?.includes('text/')) {
          data = await response.text() as unknown as T;
        } else {
          data = await response.blob() as unknown as T;
        }

        const apiResponse: ApiResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          ok: response.ok,
        };

        if (!response.ok) {
          const error: ApiError = {
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            statusText: response.statusText,
            details: data,
          };
          throw await this.applyErrorInterceptors(error);
        }

        // 应用响应拦截器
        const finalResponse = await this.applyResponseInterceptors(apiResponse);
        
        // 缓存响应
        if (finalConfig.cache && finalConfig.method === 'GET') {
          const cacheKey = this.getCacheKey(fullUrl, finalConfig);
          this.setCache(cacheKey, finalResponse);
        }

        return finalResponse;
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = {
              message: 'Request timeout',
              code: 'TIMEOUT',
            };
          } else {
            lastError = {
              message: error.message,
              code: 'NETWORK_ERROR',
            };
          }
        } else {
          lastError = error as ApiError;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          throw await this.applyErrorInterceptors(lastError);
        }

        // 等待后重试
        await this.delay(retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError!;
  }

  /**
   * GET 请求
   */
  async get<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body: data });
  }

  /**
   * PUT 请求
   */
  async put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body: data });
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', body: data });
  }
}

/**
 * 默认 API 客户端实例
 */
export const apiClient = new ApiClient();

/**
 * 便捷的 API 方法
 */
export const api = {
  get: <T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>) => 
    apiClient.get<T>(url, config),
  
  post: <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>) => 
    apiClient.post<T>(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>) => 
    apiClient.put<T>(url, data, config),
  
  delete: <T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>) => 
    apiClient.delete<T>(url, config),
  
  patch: <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>) => 
    apiClient.patch<T>(url, data, config),
};

/**
 * 创建新的 API 客户端
 */
export const createApiClient = (baseURL?: string, defaultConfig?: RequestConfig) => 
  new ApiClient(baseURL, defaultConfig);

/**
 * 错误处理工具
 */
export const errorUtils = {
  /**
   * 判断是否为网络错误
   */
  isNetworkError: (error: ApiError): boolean => {
    return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
  },

  /**
   * 判断是否为服务器错误
   */
  isServerError: (error: ApiError): boolean => {
    return error.status ? error.status >= 500 : false;
  },

  /**
   * 判断是否为客户端错误
   */
  isClientError: (error: ApiError): boolean => {
    return error.status ? error.status >= 400 && error.status < 500 : false;
  },

  /**
   * 获取错误消息
   */
  getErrorMessage: (error: ApiError): string => {
    if (error.details?.message) {
      return error.details.message;
    }
    return error.message || 'Unknown error occurred';
  },

  /**
   * 格式化错误
   */
  formatError: (error: ApiError): string => {
    const message = errorUtils.getErrorMessage(error);
    if (error.status) {
      return `${error.status}: ${message}`;
    }
    return message;
  },
};

/**
 * 请求工具
 */
export const requestUtils = {
  /**
   * 创建取消令牌
   */
  createCancelToken: (): [AbortSignal, () => void] => {
    const controller = new AbortController();
    return [controller.signal, () => controller.abort()];
  },

  /**
   * 创建超时信号
   */
  createTimeoutSignal: (timeout: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  },

  /**
   * 合并信号
   */
  combineSignals: (...signals: AbortSignal[]): AbortSignal => {
    const controller = new AbortController();
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort());
    }
    
    return controller.signal;
  },

  /**
   * 构建查询字符串
   */
  buildQueryString: (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    
    return searchParams.toString();
  },

  /**
   * 构建完整 URL
   */
  buildUrl: (baseUrl: string, path: string, params?: Record<string, any>): string => {
    const url = new URL(path, baseUrl);
    
    if (params) {
      const queryString = requestUtils.buildQueryString(params);
      if (queryString) {
        url.search = queryString;
      }
    }
    
    return url.toString();
  },
};

/**
 * 导出所有 API 工具
 */
export const apiUtils = {
  ApiClient,
  apiClient,
  api,
  createApiClient,
  errorUtils,
  requestUtils,
};

export default apiUtils;