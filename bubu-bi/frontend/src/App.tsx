import { useEffect, useState, useCallback } from 'react';
import { GetTableList, GetUploadedFiles } from '../wailsjs/go/main/App';
import FilePanel from './components/FilePanel';
import QueryPanel from './components/QueryPanel';
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

			{/* 主体区域 - 类数据库工具界面 */}
			<div className="flex-1 flex overflow-hidden">
				{/* 左侧文件管理面板 */}
				<div className="w-80 bg-base-200 border-r border-base-300 flex-shrink-0">
					<FilePanel
						files={files}
						tables={tables}
						selectedTable={selectedTable}
						onTableSelect={handleTableSelect}
						onRefresh={handleFileUploaded}
					/>
				</div>

				{/* 右侧主要内容区域 */}
				<div className="flex-1 flex flex-col overflow-hidden">
					<QueryPanel
						selectedTable={selectedTable}
						onTableDataChange={loadData}
					/>
				</div>
			</div>

			{/* 设置面板 */}
			{showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
		</div>
	);
}

export default App;
