import { useState, useCallback } from 'react';
import {
	ExecuteNaturalLanguageQuery,
	ProcessNaturalLanguage,
	ProcessNaturalLanguageWithFiles,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { PromptTemplates, ERROR_MESSAGES } from '../utils/promptTemplates';

type BackendQueryResult = main.QueryResult;
type LLMProcessResult = main.LLMProcessResult;

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  data?: BackendQueryResult;
  chart?: any;
  insights?: string[];
  suggestions?: string[];
  // 调试信息（仅开发者可见）
  debugInfo?: {
    originalPrompt?: string;
    llmRawResponse?: any;
    processingTime?: number;
    apiEndpoint?: string;
    modelUsed?: string;
  };
}

interface ProcessResult {
  message: string;
  data?: BackendQueryResult;
  chart?: any;
  insights?: string[];
  suggestions?: string[];
  debugInfo?: {
    originalPrompt?: string;
    llmRawResponse?: any;
    processingTime?: number;
    apiEndpoint?: string;
    modelUsed?: string;
  };
}

export const useConversationQuery = (selectedFiles?: string[]) => {
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // 处理自然语言查询
	const processNaturalLanguage = async (query: string, context: ConversationMessage[]): Promise<ProcessResult> => {
		const startTime = Date.now();
		
		try {
			// 根据是否有选中文件来决定调用哪个方法
			const llmResult: LLMProcessResult = selectedFiles && selectedFiles.length > 0 
				? await ProcessNaturalLanguageWithFiles(query, selectedFiles)
				: await ProcessNaturalLanguage(query);
      const processingTime = Date.now() - startTime;
      
      // 构建调试信息
      const debugInfo = {
        originalPrompt: `用户查询: ${query}\n\n上下文: ${context.length > 0 ? '包含' + context.length + '条历史消息' : '无历史消息'}`,
        llmRawResponse: llmResult,
        processingTime,
        apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
        modelUsed: 'doubao-seed-1.6-flash-250615'
      };
      
      // 如果有SQL，执行查询
      if (llmResult.sql) {
        const queryResult: BackendQueryResult = await ExecuteNaturalLanguageQuery(llmResult.sql);
        
        return {
          message: llmResult.description || "查询完成",
          data: queryResult,
          insights: [
            `置信度: ${(llmResult.confidence * 100).toFixed(1)}%`,
            llmResult.definition || "数据分析结果"
          ],
          suggestions: llmResult.suggestions || [],
          debugInfo
        };
      } else {
        // 如果没有SQL，返回LLM的文本回复
        return {
          message: llmResult.description || "我理解了您的问题，但需要更多信息来生成查询。",
          insights: [llmResult.definition || "请提供更具体的查询条件"],
          suggestions: llmResult.suggestions || [
            "尝试描述您想要查看的具体数据",
            "指定时间范围或筛选条件"
          ],
          debugInfo
        };
      }
    } catch (error) {
      console.error('LLM处理错误:', error);
      return {
        message: ERROR_MESSAGES.PROCESSING_ERROR,
        insights: ["系统暂时无法处理此查询"],
        suggestions: [
          "检查网络连接",
          "尝试简化查询内容",
          "稍后重试"
        ]
      };
    }
  };

  // 处理用户查询
  const processQuery = useCallback(async (query: string) => {
    if (!query.trim()) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setConversations(prev => [...prev, userMessage]);
     setLoading(true);

    try {
      const result = await processNaturalLanguage(query, conversations);
      
      const assistantMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.message,
        timestamp: new Date(),
        data: result.data,
        chart: result.chart,
        insights: result.insights,
        suggestions: result.suggestions,
        debugInfo: result.debugInfo
      };

      setConversations(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('查询处理错误:', error);
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : ERROR_MESSAGES.QUERY_FAILED,
        timestamp: new Date()
      };

      setConversations(prev => [...prev, errorMessage]);
    } finally {
       setLoading(false);
     }
  }, [conversations]);
  
  // 清空对话历史
  const clearConversations = useCallback(() => {
    setConversations([]);
  }, []);
  

  
  return {
    conversations,
    isLoading: loading,
    processQuery,
    clearConversations
  };
};

export default useConversationQuery;