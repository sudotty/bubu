import React, { useState, useRef, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { SmartSuggestions } from './SmartSuggestions';
import { InputSuggestions } from './InputSuggestions';
import { useSmartSuggestions } from '../hooks/useSmartSuggestions';

type QueryHistory = main.QueryHistory;
type QueryMode = 'natural' | 'sql';

interface QueryInputProps {
	query: string;
	setQuery: (query: string) => void;
	queryMode: QueryMode;
	setQueryMode: (mode: QueryMode) => void;
	queryHistory: QueryHistory[];
	loading: boolean;
	onExecute: () => void;
	onProcessNaturalLanguage: () => void;
	showSqlPreview: boolean;
	selectedFile?: string;
}

export const QueryInput: React.FC<QueryInputProps> = ({
	query,
	setQuery,
	queryMode,
	setQueryMode,
	queryHistory,
	loading,
	onExecute,
	onProcessNaturalLanguage,
	showSqlPreview,
	selectedFile,
}) => {
	const [showInputSuggestions, setShowInputSuggestions] = useState(false);
	const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { suggestions, loading: suggestionsLoading, generateSuggestions } = useSmartSuggestions();

	// 当选择文件时刷新建议
	useEffect(() => {
		if (selectedFile) {
			generateSuggestions();
		}
	}, [selectedFile, generateSuggestions]);

	// 处理输入变化
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setQuery(value);
		
		// 显示输入建议
		if (value.trim() && queryMode === 'natural') {
			setShowInputSuggestions(true);
		} else {
			setShowInputSuggestions(false);
		}
	};

	// 处理智能建议选择
	const handleSmartSuggestionClick = (suggestion: any) => {
		setQuery(suggestion.query);
		setShowSmartSuggestions(false);
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	};

	// 处理输入建议选择
	const handleInputSuggestionSelect = (suggestion: any) => {
		setQuery(suggestion.text);
		setShowInputSuggestions(false);
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	};

	// 处理焦点事件
	const handleFocus = () => {
		if (!query.trim() && queryMode === 'natural') {
			setShowSmartSuggestions(true);
		}
	};

	const handleBlur = () => {
		// 延迟关闭，允许点击建议
		setTimeout(() => {
			setShowSmartSuggestions(false);
		}, 200);
	};
	return (
		<div className="space-y-4">
			{/* AI助手欢迎信息 */}
			<div className="bg-base-200 rounded-lg p-4">
				<div className="flex items-start space-x-3">
					<div className="text-2xl">🤖</div>
					<div>
						<h3 className="font-semibold text-base-content">AI分析助手</h3>
						<p className="text-sm text-base-content/70 mt-1">
							您好！我是您的Excel分析助手。请用自然语言描述您想要分析的数据，我会帮您完成分析任务。
						</p>
					</div>
				</div>
			</div>

			{/* 高级模式切换（隐藏在设置中） */}
			<div className="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div className="collapse-title text-sm font-medium">🔧 高级选项</div>
				<div className="collapse-content">
					<div className="tabs tabs-boxed tabs-sm">
						<button
							className={`tab ${queryMode === 'natural' ? 'tab-active' : ''}`}
							onClick={() => setQueryMode('natural')}
						>
							💬 自然语言
						</button>
						<button
							className={`tab ${queryMode === 'sql' ? 'tab-active' : ''}`}
							onClick={() => setQueryMode('sql')}
						>
							⚡ 技术模式
						</button>
					</div>
				</div>
			</div>

			{/* AI对话输入区域 */}
			<div className="form-control relative">
				<label className="label">
					<span className="label-text flex items-center space-x-2">
						<span>💡</span>
						<span>
							{queryMode === 'natural' ? '请描述您的数据分析需求' : '技术模式 - 直接输入查询语句'}
						</span>
					</span>
					{queryMode === 'natural' && (
						<button
							type="button"
							className="btn btn-ghost btn-xs"
							onClick={() => setShowSmartSuggestions(!showSmartSuggestions)}
							disabled={suggestionsLoading}
						>
							{suggestionsLoading ? (
								<span className="loading loading-spinner loading-xs"></span>
							) : (
								'🎯 智能建议'
							)}
						</button>
					)}
				</label>
				<div className="relative">
					<textarea
						ref={textareaRef}
						className="textarea textarea-bordered h-32 resize-none w-full"
						placeholder={
							queryMode === 'natural'
								? '例如：\n• 分析各团队的销售业绩排名\n• 统计本月订单数量和金额\n• 找出销售额最高的产品类别\n• 对比不同地区的客户分布'
								: '例如：SELECT * FROM users WHERE age > 18'
						}
						value={query}
						onChange={handleInputChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						disabled={loading}
					/>
					
					{/* 智能建议面板 */}
					{showSmartSuggestions && queryMode === 'natural' && (
						<div className="absolute top-full left-0 right-0 z-10 mt-1">
							<SmartSuggestions
								suggestions={suggestions}
								loading={suggestionsLoading}
								onSuggestionClick={handleSmartSuggestionClick}
							/>
						</div>
					)}
					
					{/* 输入联想 */}
					<InputSuggestions
						input={query}
						suggestions={[]}
						onSuggestionSelect={handleInputSuggestionSelect}
						onClose={() => setShowInputSuggestions(false)}
						visible={showInputSuggestions}
						position={{ top: 140, left: 0 }}
					/>
				</div>
			</div>

			{/* AI分析按钮 */}
			<div className="flex gap-2">
				{queryMode === 'natural' && (
					<button
						className="btn btn-outline btn-sm"
						onClick={onProcessNaturalLanguage}
						disabled={loading || !query.trim()}
					>
						{loading ? (
							<>
								<span className="loading loading-spinner loading-xs"></span>
								🤖 AI思考中...
							</>
						) : (
							'🔍 查看分析方案'
						)}
					</button>
				)}
				<button
					className="btn btn-primary btn-sm"
					onClick={onExecute}
					disabled={loading || !query.trim()}
				>
					{loading ? (
						<>
							<span className="loading loading-spinner loading-xs"></span>
							🚀 分析中...
						</>
					) : (
						queryMode === 'natural' ? '🚀 开始分析' : '⚡ 执行查询'
					)}
				</button>
			</div>

			{/* 分析历史 */}
			{queryHistory.length > 0 && (
				<div className="collapse collapse-arrow bg-base-200">
					<input type="checkbox" />
					<div className="collapse-title text-sm font-medium">📚 分析历史</div>
					<div className="collapse-content">
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{queryHistory.slice(0, 10).map((item, index) => (
								<div
									key={index}
									className="p-2 bg-base-100 rounded cursor-pointer hover:bg-base-300 transition-colors"
									onClick={() => setQuery(item.query)}
								>
									<div className="text-xs text-base-content/70 flex items-center space-x-1">
										<span>🕒</span>
										<span>{new Date(item.created_at).toLocaleString()}</span>
									</div>
									<div className="text-sm truncate">{item.query}</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};