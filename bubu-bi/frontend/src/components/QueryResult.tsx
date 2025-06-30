import React from 'react';
import { main } from '../../wailsjs/go/models';

type QueryResult = main.QueryResult;

interface QueryResultProps {
	result: QueryResult | null;
	error: string | null;
	exporting: boolean;
	copySuccess: string;
	onExportToExcel: () => void;
	onCopy: (text: string, type: string) => void;
}

export const QueryResult: React.FC<QueryResultProps> = ({
	result,
	error,
	exporting,
	copySuccess,
	onExportToExcel,
	onCopy,
}) => {
	// 格式化查询结果
	const formatValue = (value: any): string => {
		if (value === null || value === undefined) return '';
		if (typeof value === 'object') {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}
		return String(value);
	};

	if (error) {
		return (
			<div className="alert alert-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{error}</span>
			</div>
		);
	}

	if (!result) {
		return (
			<div className="text-center text-base-content/50 py-8">
				<div className="text-4xl mb-2">📊</div>
				<div>执行查询后，结果将在这里显示</div>
			</div>
		);
	}

	if (!result.rows || result.rows.length === 0) {
		return (
			<div className="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>查询执行成功，但没有返回数据</span>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* 结果统计和操作 */}
			<div className="flex justify-between items-center">
				<div className="text-sm text-base-content/70">
					共 {result.rows.length} 条记录
					{result.columns && `, ${result.columns.length} 个字段`}
				</div>
				<div className="flex gap-2">
					<button
						className="btn btn-outline btn-xs"
						onClick={() => onCopy(JSON.stringify(result.rows, null, 2), 'JSON数据')}
					>
						复制JSON
					</button>
					<button
						className="btn btn-primary btn-xs"
						onClick={onExportToExcel}
						disabled={exporting}
					>
						{exporting ? (
							<>
								<span className="loading loading-spinner loading-xs"></span>
								导出中...
							</>
						) : (
							'导出Excel'
						)}
					</button>
				</div>
			</div>

			{/* 成功提示 */}
			{copySuccess && (
				<div className="alert alert-success">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{copySuccess}</span>
				</div>
			)}

			{/* 结果表格 */}
			<div className="overflow-x-auto bg-base-100 rounded-lg border">
				<table className="table table-zebra table-pin-rows">
					<thead>
						<tr>
							{result.columns?.map((column, index) => (
								<th key={index} className="bg-base-200">
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{result.rows.map((row: any[], rowIndex: number) => (
							<tr key={rowIndex}>
								{row.map((cell: any, colIndex: number) => (
									<td key={colIndex} className="max-w-xs truncate">
										<span title={formatValue(cell)}>
											{formatValue(cell)}
										</span>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};