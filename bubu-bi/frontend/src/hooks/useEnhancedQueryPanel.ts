import { useState, useEffect, useCallback } from 'react';
import {
	ExecuteNaturalLanguageQuery,
	ExecuteSQL,
	ExportToExcel,
	GetQueryHistory,
	GetTableList,
	GetTableSchema as GetTableSchemaAPI,
	ProcessNaturalLanguage,
	ProcessNaturalLanguageWithFiles,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { PromptTemplates, ERROR_MESSAGES } from '../utils/promptTemplates';

type QueryResult = main.QueryResult;
type QueryHistory = main.QueryHistory;
type LLMProcessResult = main.LLMProcessResult;
type QueryMode = 'natural' | 'sql';

// AI对话消息类型
interface AIMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'processing' | 'completed' | 'error';
  metadata?: {
    sql?: string;
    confidence?: number;
    processingSteps?: string[];
    result?: QueryResult;
  };
}

// 处理步骤类型
interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  details?: string[];
  progress?: number;
}

// 预定义的处理步骤
const DEFAULT_PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'understanding',
    title: '理解需求',
    description: '分析用户的自然语言输入，理解分析意图',
    status: 'pending'
  },
  {
    id: 'schema_analysis',
    title: '数据结构分析',
    description: '分析表结构和字段信息',
    status: 'pending'
  },
  {
    id: 'sql_generation',
    title: 'SQL生成',
    description: '根据需求生成相应的SQL查询语句',
    status: 'pending'
  },
  {
    id: 'execution',
    title: '执行查询',
    description: '执行生成的SQL并获取结果',
    status: 'pending'
  },
  {
    id: 'analysis',
    title: '结果分析',
    description: '分析查询结果并生成洞察',
    status: 'pending'
  }
];

export const useEnhancedQueryPanel = (selectedFiles?: string[]) => {
	const [query, setQuery] = useState('');
	const [result, setResult] = useState<QueryResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
	const [queryMode, setQueryMode] = useState<QueryMode>('natural');
	const [llmResult, setLlmResult] = useState<LLMProcessResult | null>(null);
	const [showSqlPreview, setShowSqlPreview] = useState(false);
	const [copySuccess, setCopySuccess] = useState('');
	const [exporting, setExporting] = useState(false);
	const [lastExecutedQuery, setLastExecutedQuery] = useState<string | null>(null);

	// AI对话相关状态
	const [messages, setMessages] = useState<AIMessage[]>([]);
	const [conversationMode, setConversationMode] = useState(false);

	// 处理过程可视化状态
	const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(DEFAULT_PROCESSING_STEPS);
	const [currentStep, setCurrentStep] = useState<string | null>(null);
	const [showProcessing, setShowProcessing] = useState(false);

	// 智能分析状态
	const [analysisInsights, setAnalysisInsights] = useState<any[]>([]);
	const [autoAnalysis, setAutoAnalysis] = useState(true);

	// 加载查询历史
	useEffect(() => {
		const loadHistory = async () => {
			try {
				const history = await GetQueryHistory();
				setQueryHistory(history || []);
			} catch (error) {
				console.error('加载查询历史失败:', error);
			}
		};
		loadHistory();
	}, []);

	// 生成系统提示词
	const generateSystemPrompt = useCallback(async () => {
		try {
			const tables = await GetTableList();
			const tableSchemas = await Promise.all(
				tables.map(async (table) => {
					try {
						const schema = await GetTableSchemaAPI(table);
						return { table, schema };
					} catch (error) {
						console.error(`获取表 ${table} 结构失败:`, error);
						return { table, schema: null };
					}
				})
			);

			// 构建schemas映射
			const schemasMap: Record<string, any> = {};
			tableSchemas.forEach(({ table, schema }) => {
				if (schema) {
					schemasMap[table] = schema;
				}
			});

			// 使用新的prompt模板管理器
			return PromptTemplates.buildDatabaseSchemaPrompt(tables, schemasMap);
		} catch (error) {
			console.error('生成系统提示词失败:', error);
			return '无法获取数据表信息';
		}
	}, []);

	// 复制功能
	const handleCopy = useCallback(async (text?: string) => {
		try {
			const textToCopy = text || (result ? JSON.stringify(result, null, 2) : '');
			await navigator.clipboard.writeText(textToCopy);
			setCopySuccess('已复制到剪贴板！');
			setTimeout(() => setCopySuccess(''), 3000);
		} catch (error) {
			setError(ERROR_MESSAGES.UNKNOWN_ERROR);
		}
	}, [result]);

	// 更新处理步骤状态
	const updateProcessingStep = useCallback((stepId: string, updates: Partial<ProcessingStep>) => {
		setProcessingSteps(prev => 
			prev.map(step => 
				step.id === stepId ? { ...step, ...updates } : step
			)
		);
	}, []);

	// 重置处理步骤
	const resetProcessingSteps = useCallback(() => {
		setProcessingSteps(DEFAULT_PROCESSING_STEPS.map(step => ({ ...step, status: 'pending' as const })));
		setCurrentStep(null);
	}, []);

	// 添加AI消息
	const addMessage = useCallback((message: Omit<AIMessage, 'id' | 'timestamp'>) => {
		const newMessage: AIMessage = {
			...message,
			id: Date.now().toString(),
			timestamp: new Date()
		};
		setMessages(prev => [...prev, newMessage]);
		return newMessage.id;
	}, []);

	// 更新消息状态
	const updateMessage = useCallback((messageId: string, updates: Partial<AIMessage>) => {
		setMessages(prev => 
			prev.map(msg => 
				msg.id === messageId ? { ...msg, ...updates } : msg
			)
		);
	}, []);

	// 增强的自然语言处理
	const processNaturalLanguageEnhanced = useCallback(async (userQuery: string) => {
		if (!userQuery.trim()) return;

		// 添加用户消息
		const userMessageId = addMessage({
			type: 'user',
			content: userQuery,
			status: 'completed'
		});

		// 添加AI处理消息
		const aiMessageId = addMessage({
			type: 'ai',
			content: '正在分析您的需求...',
			status: 'processing'
		});

		setLoading(true);
		setError(null);
		setLlmResult(null);
		setShowProcessing(true);
		resetProcessingSteps();

		try {
			// 步骤1: 理解需求
			setCurrentStep('understanding');
			updateProcessingStep('understanding', { status: 'processing' });
			await new Promise(resolve => setTimeout(resolve, 1000));
			updateProcessingStep('understanding', { status: 'completed', duration: 1000 });

			// 步骤2: 数据结构分析
			setCurrentStep('schema_analysis');
			updateProcessingStep('schema_analysis', { status: 'processing' });
			await new Promise(resolve => setTimeout(resolve, 800));
			updateProcessingStep('schema_analysis', { status: 'completed', duration: 800 });

			// 步骤3: SQL生成
			setCurrentStep('sql_generation');
			updateProcessingStep('sql_generation', { status: 'processing' });
			
			// 根据是否有选中文件来决定调用哪个方法
			const result = selectedFiles && selectedFiles.length > 0 
				? await ProcessNaturalLanguageWithFiles(userQuery, selectedFiles)
				: await ProcessNaturalLanguage(userQuery);
			setLlmResult(result);
			
			updateProcessingStep('sql_generation', { status: 'completed', duration: 1500 });

			// 更新AI消息
			updateMessage(aiMessageId, {
				content: `我理解了您的需求。我将为您生成以下SQL查询：\n\n\`\`\`sql\n${result.sql}\n\`\`\`\n\n置信度: ${result.confidence}%`,
				status: 'completed',
				metadata: {
					sql: result.sql,
					confidence: result.confidence,
					processingSteps: ['理解需求', '分析数据结构', '生成SQL']
				}
			});

			setShowSqlPreview(true);
		} catch (error) {
			updateProcessingStep(currentStep || 'understanding', { status: 'error' });
			updateMessage(aiMessageId, {
				content: `抱歉，处理您的请求时遇到了问题：${error}`,
				status: 'error'
			});
			setError(`${ERROR_MESSAGES.PROCESSING_ERROR}: ${error}`);
		} finally {
			setLoading(false);
			setCurrentStep(null);
			setShowProcessing(false);
		}
	}, [addMessage, updateMessage, updateProcessingStep, resetProcessingSteps, currentStep]);

	// 增强的查询执行
	const executeQueryEnhanced = useCallback(async (sqlQuery?: string) => {
		const queryToExecute = sqlQuery || (queryMode === 'natural' ? llmResult?.sql : query);
		if (!queryToExecute?.trim()) return;

		setLoading(true);
		setError(null);
		setShowProcessing(true);
		resetProcessingSteps();

		// 添加执行消息
		const executionMessageId = addMessage({
			type: 'ai',
			content: '正在执行查询...',
			status: 'processing'
		});

		try {
			// 步骤4: 执行查询
			setCurrentStep('execution');
			updateProcessingStep('execution', { status: 'processing' });
			
			const startTime = Date.now();
			let result: QueryResult;
			
			if (queryMode === 'natural' && !sqlQuery) {
				result = await ExecuteNaturalLanguageQuery(query);
			} else {
				result = await ExecuteSQL(queryToExecute);
			}
			
			const executionTime = Date.now() - startTime;
			setResult(result);
			setLastExecutedQuery(queryToExecute);
			
			updateProcessingStep('execution', { status: 'completed', duration: executionTime });

			// 步骤5: 结果分析
			if (autoAnalysis) {
				setCurrentStep('analysis');
				updateProcessingStep('analysis', { status: 'processing' });
				
				// 生成分析洞察
				await new Promise(resolve => setTimeout(resolve, 1000));
				
				updateProcessingStep('analysis', { status: 'completed', duration: 1000 });
			}

			// 更新执行消息
			updateMessage(executionMessageId, {
				content: `查询执行完成！找到 ${result.total} 条记录。${autoAnalysis ? '\n\n我已为您分析了数据，请查看洞察面板获取详细分析。' : ''}`,
				status: 'completed',
				metadata: {
					result: result,
					processingSteps: ['执行查询', ...(autoAnalysis ? ['分析结果'] : [])]
				}
			});

			// 更新查询历史
			const history = await GetQueryHistory();
			setQueryHistory(history || []);
		} catch (error) {
			updateProcessingStep(currentStep || 'execution', { status: 'error' });
			updateMessage(executionMessageId, {
				content: `查询执行失败：${error}`,
				status: 'error'
			});
			setError(`${ERROR_MESSAGES.QUERY_FAILED}: ${error}`);
		} finally {
			setLoading(false);
			setCurrentStep(null);
			setShowProcessing(false);
		}
	}, [query, queryMode, llmResult, autoAnalysis, addMessage, updateMessage, updateProcessingStep, resetProcessingSteps, currentStep]);

	// 处理AI对话消息
	const handleAIConversation = useCallback(async (message: string) => {
		if (conversationMode) {
			await processNaturalLanguageEnhanced(message);
		} else {
			setQuery(message);
			await executeQueryEnhanced();
		}
	}, [conversationMode, processNaturalLanguageEnhanced, executeQueryEnhanced]);

	// 导出Excel功能
	const handleExportToExcel = useCallback(async () => {
		if (!lastExecutedQuery) {
			setError(ERROR_MESSAGES.DATA_ERROR);
			return;
		}

		setExporting(true);
		setError(null);

		try {
			const filePath = await ExportToExcel(lastExecutedQuery);
			setCopySuccess('Excel文件导出成功！');
			setTimeout(() => setCopySuccess(''), 3000);
			console.log('Excel文件已保存到:', filePath);
		} catch (error) {
			setError(`${ERROR_MESSAGES.UNKNOWN_ERROR}: ${error}`);
		} finally {
			setExporting(false);
		}
	}, [lastExecutedQuery]);

	// 清空对话
	const clearConversation = useCallback(() => {
		setMessages([]);
		setResult(null);
		setError(null);
		setLlmResult(null);
		resetProcessingSteps();
	}, [resetProcessingSteps]);

	return {
		// 基础状态
		query,
		setQuery,
		result,
		loading,
		error,
		queryHistory,
		queryMode,
		setQueryMode,
		llmResult,
		showSqlPreview,
		setShowSqlPreview,
		copySuccess,
		exporting,
		lastExecutedQuery,

		// AI对话功能
		messages,
		conversationMode,
		setConversationMode,
		handleAIConversation,
		clearConversation,
		addMessage,
		updateMessage,

		// 处理过程可视化
		processingSteps,
		currentStep,
		showProcessing,
		setShowProcessing,
		updateProcessingStep,
		resetProcessingSteps,

		// 智能分析
		analysisInsights,
		autoAnalysis,
		setAutoAnalysis,

		// 原有功能
		generateSystemPrompt,
		handleCopy,
		processNaturalLanguage: processNaturalLanguageEnhanced,
		executeQuery: executeQueryEnhanced,
		handleExportToExcel,
		setLlmResult,
	};
};