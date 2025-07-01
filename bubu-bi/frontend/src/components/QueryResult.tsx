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
	// 生成业务洞察
	const generateInsights = (result: QueryResult) => {
		if (!result.rows || result.rows.length === 0) return [];
		
		const insights = [];
		const rowCount = result.rows.length;
		const colCount = result.columns?.length || 0;
		
		insights.push(`📊 共分析了 ${rowCount} 条数据记录`);
		
		if (colCount > 0) {
			insights.push(`📋 包含 ${colCount} 个数据字段`);
		}
		
		// 简单的数据洞察
		if (rowCount > 100) {
			insights.push(`💡 数据量较大，建议关注关键指标`);
		} else if (rowCount > 10) {
			insights.push(`✅ 数据量适中，便于详细分析`);
		} else {
			insights.push(`🔍 数据量较小，可进行精细化分析`);
		}
		
		return insights;
	};
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
			<div className="bg-error/10 border border-error/20 rounded-lg p-4">
				<div className="flex items-start space-x-3">
					<div className="text-2xl">🤖</div>
					<div>
						<h3 className="font-semibold text-error">分析遇到问题</h3>
						<p className="text-sm text-error/80 mt-1">
							抱歉，AI助手在分析数据时遇到了问题：{error}
						</p>
						<p className="text-xs text-error/60 mt-2">
							💡 建议：请检查数据格式或尝试重新描述分析需求
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!result) {
		return (
			<div className="text-center text-base-content/50 py-12">
				<div className="text-6xl mb-4">🤖</div>
				<h3 className="text-lg font-semibold mb-2">AI助手等待中</h3>
				<p className="text-sm">请在上方描述您的数据分析需求</p>
				<p className="text-xs text-base-content/40 mt-2">
					例如：分析销售数据、统计用户行为、对比业绩表现等
				</p>
			</div>
		);
	}

	if (!result.rows || result.rows.length === 0) {
		return (
			<div className="bg-info/10 border border-info/20 rounded-lg p-6">
				<div className="flex items-start space-x-3">
					<div className="text-2xl">🤖</div>
					<div>
						<h3 className="font-semibold text-info">分析完成</h3>
						<p className="text-sm text-info/80 mt-1">
							AI助手已完成分析，但根据您的条件没有找到匹配的数据。
						</p>
						<div className="mt-3 text-xs text-info/60">
							💡 建议：
							<ul className="list-disc list-inside mt-1 space-y-1">
								<li>检查筛选条件是否过于严格</li>
								<li>尝试扩大查询范围</li>
								<li>确认数据源是否包含相关信息</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const insights = generateInsights(result);

	return (
		<div className="space-y-6">
			{/* AI分析洞察 */}
			<div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 rounded-lg p-6">
				<div className="flex items-start space-x-3">
					<div className="text-2xl">🤖</div>
					<div className="flex-1">
						<h3 className="font-semibold text-primary mb-2">AI分析洞察</h3>
						<div className="space-y-2">
							{insights.map((insight, index) => (
								<div key={index} className="text-sm text-base-content/80">
									{insight}
								</div>
							))}
						</div>
					</div>
				</div>
				
				{/* 操作按钮 */}
				<div className="flex justify-end space-x-3">
					<button
						className="btn btn-outline btn-sm"
						onClick={() => onCopy(JSON.stringify(result, null, 2), 'JSON数据')}
					>
						📋 复制数据
					</button>
					<button
						className="btn btn-primary btn-sm"
						onClick={onExportToExcel}
						disabled={exporting}
					>
						{exporting ? (
							<>
								<span className="loading loading-spinner loading-xs"></span>
								正在导出...
							</>
						) : (
							<>
								📊 导出到Excel
							</>
						)}
					</button>
				</div>
			</div>

			{/* 成功提示 */}
			{copySuccess && (
				<div className="bg-success/10 border border-success/20 rounded-lg p-3">
					<div className="flex items-center space-x-2">
						<span className="text-lg">✅</span>
						<span className="text-sm text-success font-medium">{copySuccess}</span>
					</div>
				</div>
			)}

			{/* 数据分析结果 */}
			<div className="bg-base-100 rounded-lg border border-base-300 shadow-sm">
				<div className="border-b border-base-300 px-6 py-4">
					<h3 className="font-semibold text-base-content flex items-center">
						<span className="mr-2">📈</span>
						分析结果数据
						<span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
							{result.rows.length} 条记录
						</span>
					</h3>
				</div>
				<div className="overflow-x-auto">
					<table className="table table-zebra table-pin-rows">
						<thead>
							<tr className="bg-base-200">
								{result.columns?.map((column, index) => (
									<th key={index} className="font-semibold text-base-content">
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{result.rows.map((row: any[], rowIndex: number) => (
								<tr key={rowIndex} className="hover:bg-base-200/50">
									{row.map((cell: any, colIndex: number) => (
										<td key={colIndex} className="max-w-xs">
											<div 
												className="truncate" 
												title={formatValue(cell)}
											>
												{formatValue(cell)}
											</div>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};