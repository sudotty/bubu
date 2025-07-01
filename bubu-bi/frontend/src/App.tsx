import { useEffect, useState, useCallback } from 'react';
import { GetTableList, GetUploadedFiles } from '../wailsjs/go/main/App';
import FilePanel from './components/FilePanel';
import QueryPanel from './components/QueryPanel';
import EnhancedQueryPanel from './components/EnhancedQueryPanel';
import SettingsPanel from './components/SettingsPanel';
import TopToolbar from './components/TopToolbar';
import type { File } from './types';

// 扩展Window接口以包含go对象
declare global {
	interface Window {
		go?: {
			main?: {
				App?: any;
			};
		};
	}
}

function App() {
	const [files, setFiles] = useState<File[]>([]);
	const [tables, setTables] = useState<string[]>([]);
	const [selectedTable, setSelectedTable] = useState<string>('');
	const [viewMode, setViewMode] = useState<'files' | 'tables'>('files');
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [showSettings, setShowSettings] = useState(false);
	const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
	const [useEnhancedMode, setUseEnhancedMode] = useState(true);

	// 加载文件和表列表
	const loadData = useCallback(async () => {
		try {
			// 检查wails运行时是否已初始化
			if (!window.go || !window.go.main || !window.go.main.App) {
				console.warn('Wails运行时尚未初始化，跳过加载数据');
				return;
			}
			const [filesResult, tablesResult] = await Promise.all([
				GetUploadedFiles(),
				GetTableList(),
			]);
			setFiles(filesResult || []);
			setTables(tablesResult || []);
		} catch (error) {
			console.error('加载数据失败:', error);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleFileUploaded = useCallback(() => {
		loadData(); // 重新加载数据
	}, [loadData]);

	const handleTableSelect = useCallback((tableName: string) => {
		setSelectedTable(tableName);
	}, []);

	return (
		<div className="h-screen bg-base-100 flex flex-col">
			{/* 顶部工具栏 */}
			<TopToolbar
				onRefresh={loadData}
				onOpenSettings={() => setShowSettings(true)}
			/>

			{/* 模式切换按钮 */}
			<div className="px-4 py-2 bg-base-100 border-b border-base-300">
				<div className="flex items-center justify-between">
					<h1 className="text-lg font-semibold text-base-content">数据分析助手</h1>
					<div className="flex items-center space-x-2">
						<span className="text-sm text-base-content/70">界面模式:</span>
						<div className="flex bg-base-200 rounded-lg p-1">
							<button
								onClick={() => setUseEnhancedMode(false)}
								className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
									!useEnhancedMode
										? 'bg-primary text-primary-content shadow-sm'
										: 'text-base-content/70 hover:text-base-content'
								}`}
							>
								传统模式
							</button>
							<button
								onClick={() => setUseEnhancedMode(true)}
								className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
									useEnhancedMode
										? 'bg-primary text-primary-content shadow-sm'
										: 'text-base-content/70 hover:text-base-content'
								}`}
							>
								增强模式
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 主体区域 - Excel AI助手界面 */}
			<div className="flex-1 flex overflow-hidden">
				{/* 左侧文件和历史管理面板 */}
				<div className="w-80 bg-base-200 border-r border-base-300 flex-shrink-0">
					<FilePanel
						files={files}
						tables={tables}
						selectedTable={selectedTable}
						onTableSelect={handleTableSelect}
						onRefresh={handleFileUploaded}
						analysisHistory={analysisHistory}
					/>
				</div>

				{/* 右侧AI对话和分析区域 */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{useEnhancedMode ? (
						<EnhancedQueryPanel
							selectedTable={selectedTable}
							onTableDataChange={loadData}
							files={files}
							onAnalysisComplete={(analysis) => setAnalysisHistory(prev => [analysis, ...prev])}
						/>
					) : (
						<QueryPanel
							selectedTable={selectedTable}
							onTableDataChange={loadData}
							files={files}
							onAnalysisComplete={(analysis) => setAnalysisHistory(prev => [analysis, ...prev])}
						/>
					)}
				</div>
			</div>

			{/* 设置面板 */}
			{showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
		</div>
	);
}

export default App;
