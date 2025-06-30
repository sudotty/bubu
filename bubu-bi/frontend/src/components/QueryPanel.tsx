import React from 'react';
import { useQueryPanel } from './useQueryPanel';
import { QueryInput } from './QueryInput';
import { QueryResult } from './QueryResult';
import { PromptModal } from './PromptModal';

interface QueryPanelProps {
	selectedTable: string;
	onTableDataChange: () => Promise<void>;
}

export const QueryPanel: React.FC<QueryPanelProps> = ({ selectedTable, onTableDataChange }) => {
	const {
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
		generateSystemPrompt,
		handleCopy,
		processNaturalLanguage,
		executeLLMQuery,
		executeQuery,
		handleExportToExcel,
		setLlmResult,
	} = useQueryPanel();

	return (
		<div className="h-full flex flex-col">
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* 查询输入组件 */}
				<QueryInput
					query={query}
					setQuery={setQuery}
					queryMode={queryMode}
					setQueryMode={setQueryMode}
					queryHistory={queryHistory}
					loading={loading}
					onExecute={executeQuery}
					onProcessNaturalLanguage={processNaturalLanguage}
					showSqlPreview={showSqlPreview}
				/>

				{/* 查询结果组件 */}
				<QueryResult
					result={result}
					error={error}
					exporting={exporting}
					copySuccess={copySuccess}
					onExportToExcel={handleExportToExcel}
					onCopy={handleCopy}
				/>
			</div>

			{/* Prompt模态框组件 */}
			<PromptModal
				showSqlPreview={showSqlPreview}
				setShowSqlPreview={setShowSqlPreview}
				llmResult={llmResult}
				setLlmResult={setLlmResult}
				onExecuteLLMQuery={executeLLMQuery}
				onCopy={handleCopy}
				generateSystemPrompt={generateSystemPrompt}
				loading={loading}
			/>
		</div>
	);
};

export default QueryPanel;
