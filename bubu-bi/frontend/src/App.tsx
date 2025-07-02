import React, { useState, useEffect, useCallback } from 'react';
import { GetUploadedFiles } from '../wailsjs/go/main/App';
import FilePanel from './components/FilePanel';
import ConversationInterface from './components/ConversationInterface';
import AppSettingsModal from './components/AppSettingsModal';
import { useConversationQuery } from './hooks/useConversationQuery';

import { NotificationProvider, useNotificationMethods } from './components/NotificationSystem';
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

const AppContent = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [showAppSettings, setShowAppSettings] = useState(false);
	const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isProcessingFile, setIsProcessingFile] = useState(false);
	const { success, error, info } = useNotificationMethods();
	
	// 对话查询功能
	const selectedFileNames = selectedFiles?.map(file => file.filename) || [];
	
	const { 
		conversations, 
		isLoading, 
		processQuery, 
		clearConversations,
		templates,
		showTemplates,
		setShowTemplates,
		loadTemplates,
		createNewConversation,
		saveTemplate,
		useTemplate,
		deleteTemplate,
		conversationId,
		sessionId
	} = useConversationQuery(selectedFileNames);
	
	// 监控selectedFiles状态变化
	// useEffect(() => {
	//	console.log('🔍 [DEBUG] App.tsx - selectedFiles changed:', selectedFiles);
	// }, [selectedFiles]);


	// 加载文件和表列表
	const loadData = useCallback(async (showNotification = false) => {
		try {
			// 检查wails运行时是否已初始化
			if (!window.go || !window.go.main || !window.go.main.App) {
				console.warn('Wails运行时尚未初始化，跳过加载数据');
				return;
			}
			const filesResult = await GetUploadedFiles();
			setFiles(filesResult || []);
			
			if (showNotification) {
				success('数据刷新成功', `已加载 ${(filesResult || []).length} 个文件`);
			}
		} catch (err) {
			console.error('加载数据失败:', err);
			if (showNotification) {
				error('数据刷新失败', '请检查网络连接或稍后重试');
			}
		}
	}, [success, error]);

	useEffect(() => {
		loadData();
	}, []); // 只在组件挂载时执行一次

	// 全局刷新函数
	const handleGlobalRefresh = useCallback(async () => {
		if (isRefreshing) return;
		
		setIsRefreshing(true);
		info('正在刷新数据', '正在重新加载文件列表和数据表...');
		
		try {
			// 延迟一点时间让用户看到刷新效果
			await new Promise(resolve => setTimeout(resolve, 500));
			await loadData(true);
		} finally {
			setIsRefreshing(false);
		}
	}, [isRefreshing, loadData, info]);

	const handleFileUploaded = useCallback(() => {
		loadData(true); // 重新加载数据并显示通知
	}, [loadData]);



	return (
		<div className="h-screen bg-base-100 flex overflow-hidden">
			{/* 左侧区域 - 包含标题和文件面板 */}
			<div className="w-80 bg-base-200 border-r border-base-300 flex-shrink-0 flex flex-col">
				{/* 左上角标题区域 */}
				<div className="bg-base-300 border-b border-base-content/20 px-4 py-3">
					<button 
						className="flex items-center space-x-2 hover:bg-base-200 px-3 py-2 rounded-lg transition-colors duration-200 group w-full"
						onClick={() => setShowAppSettings(true)}
						title="点击打开设置和主题选择"
					>
						<div className="text-2xl group-hover:scale-110 transition-transform duration-200">📊</div>
						<h1 className="text-xl font-bold text-primary group-hover:text-primary-focus">BuBu</h1>
						<div className="badge badge-primary badge-sm group-hover:badge-primary-focus">Excel AI助手</div>
					</button>
					<div className="mt-2 text-xs text-base-content/60">
						一句话处理Excel🤖 ，Make Excel Easy Again 👊
					</div>
				</div>
				
				{/* 文件面板 */}
				<div className="flex-1 overflow-hidden">
					<FilePanel
						files={files}
						onRefresh={handleGlobalRefresh}
						analysisHistory={analysisHistory}
						isRefreshing={isRefreshing}
						selectedFiles={selectedFiles}
						onFileSelect={(file) => {
					if (!file) return;
					if (selectedFiles.some(f => f.filename === file.filename && f.file_path === file.file_path)) {
						// 如果文件已选中，则取消选择
						setSelectedFiles(prev => {
							const newSelection = prev.filter(f => !(f.filename === file.filename && f.file_path === file.file_path));
							return newSelection;
						});
					} else {
						// 如果文件未选中，则添加到选择列表
						setSelectedFiles(prev => {
							const newSelection = [...prev, file];
							return newSelection;
						});
					}
				}}
						isProcessingFile={isProcessingFile}
					/>
				</div>
			</div>

			{/* 右侧统一对话界面 */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{selectedFiles.length === 0 ? (
					<div className="flex items-center justify-center h-full bg-base-100">
						<div className="text-center p-8">
							<div className="text-6xl mb-4">📊</div>
							<h3 className="text-lg font-medium text-base-content mb-2">选择数据源开始分析</h3>
							<p className="text-base-content/60">请先在左侧选择一个或多个文件作为数据源</p>
						</div>
					</div>
				) : (
					<ConversationInterface
						onQuery={processQuery}
						loading={isLoading}
						conversations={conversations}
						selectedFiles={selectedFiles}
						templates={templates}
						showTemplates={showTemplates}
						setShowTemplates={setShowTemplates}
						onSaveTemplate={saveTemplate}
						onUseTemplate={useTemplate}
						onDeleteTemplate={deleteTemplate}
					/>
				)}
			</div>

			{/* 应用设置弹窗 */}
			{showAppSettings && <AppSettingsModal onClose={() => setShowAppSettings(false)} />}
		</div>
	);
};

function App() {
	return (
		<NotificationProvider>
			<AppContent />
		</NotificationProvider>
	);
}

export default App;
