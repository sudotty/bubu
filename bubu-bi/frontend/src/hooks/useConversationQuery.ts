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
import { useRef } from 'react';
import { DebugInfo, LLMProcessResult as CustomLLMProcessResult, parseDebugInfo, stringifyDebugInfo } from '../types/debug';

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
  debugInfo?: DebugInfo;
}

interface ProcessResult {
  message: string;
  data?: BackendQueryResult;
  chart?: any;
  insights?: string[];
  suggestions?: string[];
  debugInfo?: DebugInfo;
}

export const useConversationQuery = (selectedFiles?: string[]) => {
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<main.SavedTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const sessionIdRef = useRef<string>('');

  // 生成会话ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };



  // 初始化会话和加载智能建议
  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      const newSessionId = generateSessionId();
      sessionIdRef.current = newSessionId;
      
      // 直接加载智能建议，避免循环依赖
      const loadTemplatesAsync = async () => {
        try {
          const templates = await GetTemplatesByFiles(selectedFiles);
          setTemplates(templates || []);
        } catch (error) {
          console.error('Failed to load templates:', error);
          setTemplates([]);
        }
      };
      
      loadTemplatesAsync();
    } else {
      setTemplates([]);
    }
  }, [selectedFiles]);

  // 创建新会话
  const createNewConversation = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return null;
    }
    
    try {
      const conversation = await CreateConversation(sessionIdRef.current, selectedFiles[0], `会话 ${new Date().toLocaleString()}`);
      setConversationId(conversation.id);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }, [selectedFiles]);

  // 保存会话消息
  const saveConversationMessage = useCallback(async (messageType: string, content: string, sql?: string, queryResult?: string, insights?: string[], suggestions?: string[], debugInfo?: DebugInfo) => {
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
        stringifyDebugInfo(debugInfo || {})
      );
    } catch (error) {
      console.error('Failed to save conversation message:', error);
    }
  }, [conversationId]);

  // 处理智能建议模式
  const processTemplateMode = useCallback(async (input: string, currentConversations: ConversationMessage[]) => {
    const templateInput = input.substring(6); // 移除 '#bubu#' 前缀
    
    try {
      const result = await processNaturalLanguage(templateInput, currentConversations);
      
      // 如果返回了 SQL，可以选择直接执行或让用户确认
      if (result.data) {
        return result;
      }
      
      return result;
    } catch (error) {
      console.error('Failed to process template mode:', error);
      throw error;
    }
  }, [conversationId, selectedFiles, createNewConversation, saveConversationMessage]);

  // 保存智能建议
  const saveTemplate = useCallback(async (title: string, promptText: string, sql: string, description: string) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      throw new Error('请先选择文件');
    }
    
    try {
      const template = await SaveTemplate(selectedFiles, title, promptText, sql, description);
      // 重新加载智能建议列表
      if (selectedFiles && selectedFiles.length > 0) {
        try {
          const updatedTemplates = await GetTemplatesByFiles(selectedFiles);
          setTemplates(updatedTemplates || []);
        } catch (error) {
          console.error('Failed to reload templates:', error);
        }
      }
      return template;
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  }, [selectedFiles]);

  // 使用智能建议
  const useTemplate = useCallback(async (templateId: number) => {
    try {
      await UseTemplate(templateId);
      // 重新加载智能建议列表以更新使用次数
      if (selectedFiles && selectedFiles.length > 0) {
        try {
          const updatedTemplates = await GetTemplatesByFiles(selectedFiles);
          setTemplates(updatedTemplates || []);
        } catch (error) {
          console.error('Failed to reload templates:', error);
        }
      }
    } catch (error) {
      console.error('Failed to use template:', error);
      throw error;
    }
  }, [selectedFiles]);

  // 删除智能建议
  const deleteTemplate = useCallback(async (templateId: number) => {
    try {
      await DeleteTemplate(templateId);
      // 重新加载智能建议列表
      if (selectedFiles && selectedFiles.length > 0) {
        try {
          const updatedTemplates = await GetTemplatesByFiles(selectedFiles);
          setTemplates(updatedTemplates || []);
        } catch (error) {
          console.error('Failed to reload templates:', error);
        }
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  }, [selectedFiles]);

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
      console.log('🔍 [DEBUG] LLM Result:', llmResult);
      console.log('🔍 [DEBUG] LLM Result debug_info:', llmResult.debug_info);
      
      const processingTime = Date.now() - startTime;
      
      // 使用后端返回的调试信息
      const debugInfo = llmResult.debug_info ? {
        original_prompt: llmResult.debug_info.original_prompt,
        system_prompt: llmResult.debug_info.system_prompt,
        user_prompt: llmResult.debug_info.user_prompt,
        llm_raw_response: llmResult.debug_info.llm_raw_response,
        processing_time: llmResult.debug_info.processing_time,
        api_endpoint: llmResult.debug_info.api_endpoint,
        model_used: llmResult.debug_info.model_used
      } : {
        original_prompt: `用户查询: ${query}\n\n上下文: ${context.length > 0 ? '包含' + context.length + '条历史消息' : '无历史消息'}`,
        llm_raw_response: llmResult,
        processing_time: processingTime,
        api_endpoint: 'ProcessNaturalLanguage',
        model_used: 'Unknown'
      };
      
      console.log('🔍 [DEBUG] Final debugInfo:', debugInfo);
      
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

    // 检查是否是智能建议模式
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
        // 智能建议模式处理
        result = await processTemplateMode(query, conversations);
      } else {
        // 普通模式处理
        result = await processNaturalLanguage(query, conversations);
      }
      
      console.log('🔧 [DEBUG] processQuery result:', result);
      console.log('🔧 [DEBUG] processQuery result.debugInfo:', result.debugInfo);
      
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
      
      console.log('🔧 [DEBUG] assistantMessage with debugInfo:', assistantMessage);

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
      
      // 即使出错也要包含调试信息
      const errorDebugInfo = {
        original_prompt: `用户查询: ${query}`,
        llm_raw_response: error,
        processing_time: Date.now(),
        api_endpoint: 'ProcessNaturalLanguage',
        model_used: 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
      
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : ERROR_MESSAGES.QUERY_FAILED,
        timestamp: new Date(),
        debugInfo: errorDebugInfo
      };

      setConversations(prev => [...prev, errorMessage]);
      
      // 保存错误消息到数据库，包含调试信息
      await saveConversationMessage(
        'error',
        error instanceof Error ? error.message : ERROR_MESSAGES.QUERY_FAILED,
        '',
        '',
        [],
        [],
        errorDebugInfo
      );
    } finally {
       setLoading(false);
     }
  }, [conversationId, selectedFiles, createNewConversation, saveConversationMessage, processTemplateMode]);
  
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
    createNewConversation,
    saveConversationMessage,
    processTemplateMode,
    saveTemplate,
    useTemplate,
    deleteTemplate,
    conversationId,
    sessionId: sessionIdRef.current
  };
};

export default useConversationQuery;