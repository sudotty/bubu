import { useState, useEffect, useCallback } from 'react';
import {
	ExecuteNaturalLanguageQuery,
	ExecuteSQL,
	ExportToExcel,
	GetQueryHistory,
	GetTableList,
	GetTableSchema as GetTableSchemaAPI,
	ProcessNaturalLanguage,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

type QueryResult = main.QueryResult;
type QueryHistory = main.QueryHistory;
type LLMProcessResult = main.LLMProcessResult;
type QueryMode = 'natural' | 'sql';

export const useQueryPanel = () => {
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
						return { table, schema: schema || [] };
					} catch (error) {
						console.error(`获取表 ${table} 结构失败:`, error);
						return { table, schema: [] };
					}
				})
			);

			let prompt = `你是一个专业的SQL查询助手。请根据用户的自然语言描述，生成准确的SQL查询语句。\n\n`;
			prompt += `数据库结构信息：\n`;

			tableSchemas.forEach(({ table, schema }) => {
				prompt += `\n表名: ${table}\n`;
				if (Array.isArray(schema) && schema.length > 0) {
					prompt += `字段:\n`;
					schema.forEach((column: any) => {
						prompt += `  - ${column.name} (${column.type})${column.nullable ? ' [可为空]' : ' [非空]'}\n`;
					});
				} else {
					prompt += `  暂无字段信息\n`;
				}
			});

			prompt += `\n请注意：\n`;
			prompt += `1. 只返回SQL语句，不要包含任何解释或格式化\n`;
			prompt += `2. 使用标准的SQLite语法\n`;
			prompt += `3. 字段名和表名请使用反引号包围\n`;
			prompt += `4. 如果需要限制结果数量，请使用LIMIT子句\n`;
			prompt += `5. 确保SQL语句语法正确且可执行\n\n`;
			prompt += `用户查询: `;

			return prompt;
		} catch (error) {
			console.error('生成系统提示词失败:', error);
			return '生成系统提示词失败';
		}
	}, []);

	const handleCopy = useCallback(async (text: string, type: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopySuccess(`${type}复制成功！`);
			setTimeout(() => setCopySuccess(''), 2000);
		} catch (_err) {
			setCopySuccess('复制失败，请手动复制');
			setTimeout(() => setCopySuccess(''), 2000);
		}
	}, []);

	// 处理自然语言查询
	const processNaturalLanguage = useCallback(async () => {
		if (!query.trim()) return;

		setLoading(true);
		setError(null);
		setLlmResult(null);
		setShowSqlPreview(false);

		try {
			const result = await ProcessNaturalLanguage(query);
			setLlmResult(result);
			setShowSqlPreview(true);
		} catch (error) {
			setError(`自然语言处理失败: ${error}`);
		} finally {
			setLoading(false);
		}
	}, [query]);

	// 执行LLM生成的SQL
	const executeLLMQuery = useCallback(async () => {
		if (!llmResult?.sql) return;

		setLoading(true);
		setError(null);

		try {
			const result = await ExecuteSQL(llmResult.sql);
			setResult(result);
			setLastExecutedQuery(llmResult.sql);
			const history = await GetQueryHistory();
			setQueryHistory(history || []);
		} catch (error) {
			setError(`查询执行失败: ${error}`);
		} finally {
			setLoading(false);
		}
	}, [llmResult]);

	// 执行SQL查询
	const executeQuery = useCallback(async () => {
		if (!query.trim()) return;

		setLoading(true);
		setError(null);

		try {
			if (queryMode === 'natural') {
				const result = await ExecuteNaturalLanguageQuery(query);
				setResult(result);
				setLastExecutedQuery(query);
			} else {
				const result = await ExecuteSQL(query);
				setResult(result);
				setLastExecutedQuery(query);
			}
			const history = await GetQueryHistory();
			setQueryHistory(history || []);
		} catch (error) {
			setError(`查询执行失败: ${error}`);
		} finally {
			setLoading(false);
		}
	}, [query, queryMode]);

	// 导出Excel功能
	const handleExportToExcel = useCallback(async () => {
		if (!lastExecutedQuery) {
			setError('没有可导出的查询结果，请先执行查询');
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
			setError(`导出Excel失败: ${error}`);
		} finally {
			setExporting(false);
		}
	}, [lastExecutedQuery]);

	return {
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
		generateSystemPrompt,
		handleCopy,
		processNaturalLanguage,
		executeLLMQuery,
		executeQuery,
		handleExportToExcel,
		setLlmResult,
	};
};