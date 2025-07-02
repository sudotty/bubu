/**
 * 调试信息类型定义
 * 与后端 Go 结构体保持一致
 */
export interface DebugInfo {
  original_prompt?: string;
  system_prompt?: string;
  user_prompt?: string;
  llm_raw_response?: any;
  processing_time?: number;
  api_endpoint?: string;
  model_used?: string;
}

/**
 * LLM 处理结果类型定义
 * 与后端 Go 结构体保持一致
 */
export interface LLMProcessResult {
  sql: string;
  business_id: string;
  definition: string;
  description: string;
  confidence: number;
  suggestions: string[];
  debug_info?: DebugInfo;
}

/**
 * 类型安全的调试信息解析函数
 */
export const parseDebugInfo = (debugInfoStr: string): DebugInfo | undefined => {
  try {
    if (!debugInfoStr || debugInfoStr.trim() === '') {
      return undefined;
    }
    
    const parsed = JSON.parse(debugInfoStr);
    
    // 类型验证和字段映射
    const debugInfo: DebugInfo = {
      original_prompt: parsed.original_prompt || parsed.originalPrompt,
      system_prompt: parsed.system_prompt || parsed.systemPrompt,
      user_prompt: parsed.user_prompt || parsed.userPrompt,
      llm_raw_response: parsed.llm_raw_response || parsed.llmRawResponse,
      processing_time: parsed.processing_time || parsed.processingTime,
      api_endpoint: parsed.api_endpoint || parsed.apiEndpoint,
      model_used: parsed.model_used || parsed.modelUsed,
    };
    
    return debugInfo;
  } catch (error) {
    console.error('Failed to parse debug info:', error);
    return undefined;
  }
};

/**
 * 调试信息序列化函数
 */
export const stringifyDebugInfo = (debugInfo: DebugInfo): string => {
  try {
    return JSON.stringify(debugInfo);
  } catch (error) {
    console.error('Failed to stringify debug info:', error);
    return '{}';
  }
};

/**
 * 验证调试信息是否有效
 */
export const isValidDebugInfo = (debugInfo: any): debugInfo is DebugInfo => {
  return debugInfo && typeof debugInfo === 'object';
};