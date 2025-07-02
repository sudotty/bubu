import { useState, useCallback, useEffect } from 'react';
import {
	ExecuteNaturalLanguageQuery,
	ProcessNaturalLanguage,
	ProcessNaturalLanguageWithFiles,
	CreateConversation,
	GetConversation,
	GetConversationsByFiles,
	UpdateConversationTitle,
	SaveConversationMessage,
	GetConversationMessages,
	SaveTemplate,
	GetTemplatesByFiles,
	UpdateTemplate,
	UseTemplate,
	DeleteTemplate,
	ExecuteTemplateSQL,
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
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<main.SavedTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // 生成会话ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 初始化会话
  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      loadTemplates();
    }
  }, [selectedFiles]);

  // 加载话术本
  const loadTemplates = useCallback(async () => {
    if (selectedFiles && selectedFiles.length > 0) {
      try {
        const templates = await GetTemplatesByFiles(selectedFiles);
        setTemplates(templates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    } else {
      setTemplates([]);
    }
  }, [selectedFiles]);

  // 当选择的文件改变时，重新加载话术本
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 创建新会话
  const createNewConversation = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return null;
    }
    
    try {
      const conversation = await CreateConversation(sessionId, selectedFiles, `会话 ${new Date().toLocaleString()}`);
      setConversationId(conversation.id);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }, [selectedFiles]);

  // 保存会话消息
  const saveConversationMessage = useCallback(async (messageType: string, content: string, sql?: string, queryResult?: string, insights?: string[], suggestions?: string[], debugInfo?: any) => {
    if (!conversationId) {
      return;
    }
    
    try {
      await SaveConversationMessage(
        conversationId,
        messageType,
        content,
        sql || '',
        queryResult || '',
        JSON.stringify(insights || []),
        JSON.stringify(suggestions || []),
        JSON.stringify(debugInfo || {})
      );
    } catch (error) {
      console.error('Failed to save conversation message:', error);
    }
  }, [conversationId]);

  // 处理话术本模式
  const processTemplateMode = useCallback(async (input: string) => {
    const templateInput = input.substring(6); // 移除 '#bubu#' 前缀
    
    try {
      const result = await processNaturalLanguage(templateInput, conversations);
      
      // 如果返回了 SQL，可以选择直接执行或让用户确认
      if (result.data) {
        return result;
      }
      
      return result;
    } catch (error) {
      console.error('Failed to process template mode:', error);
      throw error;
    }
  }, [conversations]);

  // 保存话术本
  const saveTemplate = useCallback(async (title: string, promptText: string, sql: string, description: string) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      throw new Error('请先选择文件');
    }
    
    try {
      const template = await SaveTemplate(selectedFiles, title, promptText, sql, description);
      await loadTemplates(); // 重新加载话术本列表
      return template;
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  }, [selectedFiles, loadTemplates]);

  // 使用话术本
  const useTemplate = useCallback(async (templateId: number) => {
    try {
      await UseTemplate(templateId);
      await loadTemplates(); // 重新加载话术本列表以更新使用次数
    } catch (error) {
      console.error('Failed to use template:', error);
      throw error;
    }
  }, [loadTemplates]);

  // 删除话术本
  const deleteTemplate = useCallback(async (templateId: number) => {
    try {
      await DeleteTemplate(templateId);
      await loadTemplates(); // 重新加载话术本列表
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  }, [loadTemplates]);

  // 处理自然语言查询
	const processNaturalLanguage = async (query: string, context: ConversationMessage[]): Promise<ProcessResult> => {
		const startTime = Date.now();
		
		try {
			// 调试日志：打印选中的文件
			// Debug logs removed to prevent console spam
			
			// 检查是否选择了文件
			if (!selectedFiles || selectedFiles.length === 0) {
				throw new Error('请先在左侧选择一个或多个数据文件作为查询数据源');
			}
			
			// 调用带文件的处理方法
			const llmResult: LLMProcessResult = await ProcessNaturalLanguageWithFiles(query, selectedFiles);
			
			// 调试日志：打印LLM结果
			// LLM result processed
      const processingTime = Date.now() - startTime;
      
      // 使用后端返回的调试信息
      const debugInfo = llmResult.debug_info ? {
        originalPrompt: llmResult.debug_info.original_prompt,
        llmRawResponse: llmResult.debug_info.llm_raw_response,
        processingTime: llmResult.debug_info.processing_time,
        apiEndpoint: llmResult.debug_info.api_endpoint,
        modelUsed: llmResult.debug_info.model_used,
        generatedSQL: llmResult.sql // 添加生成的SQL查询
      } : {
        originalPrompt: `用户查询: ${query}\n\n上下文: ${context.length > 0 ? '包含' + context.length + '条历史消息' : '无历史消息'}`,
        llmRawResponse: llmResult,
        processingTime,
        apiEndpoint: 'ProcessNaturalLanguage',
        modelUsed: 'Unknown',
        generatedSQL: llmResult.sql // 添加生成的SQL查询
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

    // 检查是否是话术本模式
    const isTemplateMode = query.startsWith('#bubu#');
    
    // 如果没有会话ID，创建新会话
    if (!conversationId && selectedFiles && selectedFiles.length > 0) {
      await createNewConversation();
    }

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setConversations(prev => [...prev, userMessage]);
     setLoading(true);

    try {
      // 保存用户消息到数据库
      await saveConversationMessage('user', query);
      
      let result;
      if (isTemplateMode) {
        // 话术本模式处理
        result = await processTemplateMode(query);
      } else {
        // 普通模式处理
        result = await processNaturalLanguage(query, conversations);
      }
      
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

      // 保存助手消息到数据库
       await saveConversationMessage(
          'assistant',
          result.message,
          '',
          JSON.stringify(result.data || {}),
          result.insights,
          result.suggestions,
          result.debugInfo
        );

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
    clearConversations,
    templates,
    showTemplates,
    setShowTemplates,
    loadTemplates,
    createNewConversation,
    saveConversationMessage,
    processTemplateMode,
    saveTemplate,
    useTemplate,
    deleteTemplate,
    conversationId,
    sessionId
  };
};

export default useConversationQuery;