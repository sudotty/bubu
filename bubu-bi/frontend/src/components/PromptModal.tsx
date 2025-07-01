import React from 'react';
import { main } from '../../wailsjs/go/models';

type LLMProcessResult = main.LLMProcessResult;

interface PromptModalProps {
	showSqlPreview: boolean;
	setShowSqlPreview: (show: boolean) => void;
	llmResult: LLMProcessResult | null;
	setLlmResult: (result: LLMProcessResult | null) => void;
	onExecuteLLMQuery: () => void;
	onCopy: (text: string, type: string) => void;
	generateSystemPrompt: () => Promise<string>;
	loading: boolean;
}

export const PromptModal: React.FC<PromptModalProps> = ({
	showSqlPreview,
	setShowSqlPreview,
	llmResult,
	setLlmResult,
	onExecuteLLMQuery,
	onCopy,
	generateSystemPrompt,
	loading,
}) => {
	const [showPromptModal, setShowPromptModal] = React.useState(false);
	const [systemPrompt, setSystemPrompt] = React.useState('');
	const [loadingPrompt, setLoadingPrompt] = React.useState(false);

	const handleShowPrompt = async () => {
		setLoadingPrompt(true);
		try {
			const prompt = await generateSystemPrompt();
			setSystemPrompt(prompt);
			setShowPromptModal(true);
		} catch (error) {
			console.error('生成系统提示词失败:', error);
		} finally {
			setLoadingPrompt(false);
		}
	};

	return (
		<>
			{/* SQL预览模态框 */}
			{showSqlPreview && llmResult && (
				<div className="modal modal-open">
				<div className="modal-box max-w-2xl">
						<h3 className="font-bold text-lg mb-4">LLM处理结果</h3>

						{/* 生成的SQL */}
						<div className="space-y-4">
							<div>
								<div className="flex justify-between items-center mb-2">
									<label className="label-text font-medium">生成的SQL:</label>
									<button
										className="btn btn-outline btn-xs"
										onClick={() => onCopy(llmResult.sql, 'SQL语句')}
									>
										复制SQL
									</button>
								</div>
								<div className="mockup-code">
									<pre className="px-4 py-2">
										<code>{llmResult.sql}</code>
									</pre>
								</div>
							</div>

							{/* 解释说明 */}
							{llmResult.description && (
								<div>
									<label className="label-text font-medium">解释说明:</label>
									<div className="bg-base-200 p-3 rounded mt-2">
										<p className="text-sm">{llmResult.description}</p>
									</div>
								</div>
							)}

							{/* 置信度 */}
							{llmResult.confidence !== undefined && (
								<div>
									<label className="label-text font-medium">置信度:</label>
									<div className="flex items-center gap-2 mt-2">
										<progress
											className="progress progress-primary w-32"
											value={llmResult.confidence * 100}
											max="100"
										></progress>
										<span className="text-sm">{(llmResult.confidence * 100).toFixed(1)}%</span>
									</div>
								</div>
							)}
						</div>

						{/* 操作按钮 */}
						<div className="modal-action">
							<button
								className="btn btn-outline"
								onClick={handleShowPrompt}
								disabled={loadingPrompt}
							>
								{loadingPrompt ? (
									<>
										<span className="loading loading-spinner loading-xs"></span>
										生成中...
									</>
								) : (
									'查看Prompt'
								)}
							</button>
							<button
								className="btn btn-primary"
								onClick={onExecuteLLMQuery}
								disabled={loading}
							>
								{loading ? (
									<>
										<span className="loading loading-spinner loading-xs"></span>
										执行中...
									</>
								) : (
									'执行SQL'
								)}
							</button>
							<button
								className="btn"
								onClick={() => {
									setShowSqlPreview(false);
									setLlmResult(null);
								}}
							>
								关闭
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Prompt查看模态框 */}
			{showPromptModal && (
				<div className="modal modal-open">
				<div className="modal-box max-w-2xl">
						<h3 className="font-bold text-lg mb-4">系统Prompt</h3>
						<div className="space-y-4">
							<div className="flex justify-between items-center">
								<span className="text-sm text-base-content/70">
									当前数据库结构的系统提示词
								</span>
								<button
									className="btn btn-outline btn-xs"
									onClick={() => onCopy(systemPrompt, '系统Prompt')}
								>
									复制Prompt
								</button>
							</div>
							<div className="mockup-code max-h-96 overflow-y-auto">
								<pre className="px-4 py-2 whitespace-pre-wrap">
									<code>{systemPrompt}</code>
								</pre>
							</div>
						</div>
						<div className="modal-action">
							<button className="btn" onClick={() => setShowPromptModal(false)}>
								关闭
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};