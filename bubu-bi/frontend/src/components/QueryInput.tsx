import React from 'react';
import { main } from '../../wailsjs/go/models';

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
}) => {
	return (
		<div className="space-y-4">
			{/* 查询模式切换 */}
			<div className="flex items-center gap-4">
				<div className="tabs tabs-boxed">
					<button
						className={`tab ${queryMode === 'natural' ? 'tab-active' : ''}`}
						onClick={() => setQueryMode('natural')}
					>
						自然语言查询
					</button>
					<button
						className={`tab ${queryMode === 'sql' ? 'tab-active' : ''}`}
						onClick={() => setQueryMode('sql')}
					>
						SQL查询
					</button>
				</div>
			</div>

			{/* 查询输入区域 */}
			<div className="form-control">
				<label className="label">
					<span className="label-text">
						{queryMode === 'natural' ? '请输入您的查询需求' : '请输入SQL语句'}
					</span>
				</label>
				<textarea
					className="textarea textarea-bordered h-32 resize-none"
					placeholder={
						queryMode === 'natural'
							? '例如：查询所有用户的订单信息'
							: '例如：SELECT * FROM users WHERE age > 18'
					}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					disabled={loading}
				/>
			</div>

			{/* 操作按钮 */}
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
								处理中...
							</>
						) : (
							'生成SQL'
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
							执行中...
						</>
					) : (
						'执行查询'
					)}
				</button>
			</div>

			{/* 查询历史 */}
			{queryHistory.length > 0 && (
				<div className="collapse collapse-arrow bg-base-200">
					<input type="checkbox" />
					<div className="collapse-title text-sm font-medium">查询历史</div>
					<div className="collapse-content">
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{queryHistory.slice(0, 10).map((item, index) => (
								<div
									key={index}
									className="p-2 bg-base-100 rounded cursor-pointer hover:bg-base-300 transition-colors"
									onClick={() => setQuery(item.query)}
								>
									<div className="text-xs text-base-content/70">
										{new Date(item.created_at).toLocaleString()}
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