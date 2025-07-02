// 剪贴板工具函数
import { DebugInfo } from '../types/debug';

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param successMessage 成功提示信息
 * @param errorMessage 失败提示信息
 * @returns Promise<boolean> 是否复制成功
 */
export const copyToClipboard = async (
  text: string,
  successMessage?: string,
  errorMessage?: string
): Promise<boolean> => {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      if (successMessage) {
        console.log(successMessage);
      }
      return true;
    }
    
    // 降级方案：使用传统的复制方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful && successMessage) {
      console.log(successMessage);
    }
    
    return successful;
  } catch (err) {
    console.error(errorMessage || '复制失败:', err);
    return false;
  }
};

/**
 * 复制消息内容到剪贴板
 * @param content 消息内容
 */
export const copyMessageContent = (content: string) => {
  return copyToClipboard(
    content,
    '消息已复制到剪贴板',
    '复制消息失败'
  );
};

/**
 * 复制调试信息到剪贴板
 * @param debugInfo 调试信息对象
 * @param type 调试信息类型
 */
export const copyDebugInfo = (debugInfo: DebugInfo, type: 'prompt' | 'sql') => {
  const content = type === 'prompt' ? debugInfo.original_prompt : debugInfo.llm_raw_response;
  const successMessage = type === 'prompt' ? 'Prompt已复制到剪贴板' : 'LLM响应已复制到剪贴板';
  const errorMessage = type === 'prompt' ? '复制Prompt失败' : '复制LLM响应失败';
  
  return copyToClipboard(content || '', successMessage, errorMessage);
};