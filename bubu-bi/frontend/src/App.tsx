import React, { useEffect, useCallback, useMemo } from 'react';
import { GetUploadedFiles } from '../wailsjs/go/main/App';
import FilePanel from './components/FilePanel';
import ConversationInterface from './components/ConversationInterface';
import { ConversationSelector } from './components/ConversationSelector';
import AppSettingsModal from './components/AppSettingsModal';
import { ThemeSelector, QuickThemeSwitcher } from './components/ThemeSelector';
import { LanguageSelector, QuickLanguageSwitcher } from './components/LanguageSelector';
import { useConversationQuery } from './hooks/useConversationQuery';
import { GetConversationsByFiles, CreateConversation } from '../wailsjs/go/main/App';
import { parseDebugInfo } from './types/debug';
import { DataProvider } from './context/DataContext';
import { NotificationProvider, useNotificationMethods } from './components/NotificationSystem';
import { useI18n } from './hooks/useI18n';
import { useAppState, useAppActions, useFileManagement, useConversationManagement } from './store';
import type { FileInfo } from './types';

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
	// 使用 Zustand store 替代分散的 useState
	const {
		files,
		selectedFiles,
		isRefreshing,
		isProcessingFile,
		showAppSettings,
		analysisHistory
	} = useAppState();
	
	const {
		setFiles,
		setIsRefreshing,
		setShowAppSettings,
		selectFile
	} = useAppActions();
	
	const {
		showConversationSelector,
		currentConversationId,
		currentMessages,
		setShowConversationSelector,
		setCurrentConversationId,
		setCurrentMessages,
		resetConversationState
	} = useConversationManagement();

	// 检查并创建会话的函数 - 使用 Zustand store 状态
	const checkAndCreateConversation = async (files: any[]) => {
		if (files.length === 0) return;
		
		// 获取文件的历史会话
		const fileKeys = files.map(f => f.filename);
		
		try {
			const conversations = await GetConversationsByFiles(fileKeys);
			
			if (conversations && conversations.length > 0) {
				// 有历史会话，显示选择器
				setShowConversationSelector(true);
				setCurrentConversationId(null);
				setCurrentMessages([]);
			} else {
				// 没有历史会话，自动创建新会话
				const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
				const title = files.length === 1 
					? `新会话 - ${files[0].filename}` 
					: `多文件会话 - ${new Date().toLocaleString()}`;
				
				const conversation = await CreateConversation(sessionId, fileKeys[0], title);
				setCurrentConversationId(conversation.id);
				setCurrentMessages([]);
				setShowConversationSelector(false);
			}
		} catch (error) {
			console.error('Failed to check conversations:', error);
			// 出错时也创建新会话
			const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			const title = files.length === 1 
				? `新会话 - ${files[0].filename}` 
				: `多文件会话 - ${new Date().toLocaleString()}`;
			
			try {
				const conversation = await CreateConversation(sessionId, fileKeys[0], title);
				setCurrentConversationId(conversation.id);
				setCurrentMessages([]);
				setShowConversationSelector(false);
			} catch (createError) {
				console.error('Failed to create conversation:', createError);
			}
		}
	};
	const { success, error, info } = useNotificationMethods();
	
	// 对话查询功能 - 使用 useMemo 避免每次渲染都创建新数组
	const selectedFileNames = useMemo(() => {
		return selectedFiles?.map(file => file.filename) || [];
	}, [selectedFiles]);
	
	const { 
		conversations, 
		isLoading, 
		processQuery, 
		clearConversations,
		templates,
		showTemplates,
		setShowTemplates,
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


	// 加载文件列表 - 使用 Zustand store
	const loadFiles = useCallback(async () => {
		setIsRefreshing(true);
		try {
			const uploadedFiles = await GetUploadedFiles();
			setFiles(uploadedFiles || []);
		} catch (err) {
			console.error('Failed to load files:', err);
			error('加载文件列表失败');
		} finally {
			setIsRefreshing(false);
		}
	}, [setFiles, setIsRefreshing, error]);

	// 加载文件和表列表 - 使用 Zustand store
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
	}, [setFiles, success, error]);

	useEffect(() => {
		loadData();
	}, []); // 只在组件挂载时执行一次

	// 全局刷新函数 - 使用 Zustand store
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
	}, [isRefreshing, setIsRefreshing, info, loadData]);

	const handleFileUploaded = useCallback(() => {
		loadData(true); // 重新加载数据并显示通知
	}, [loadData]);

	// 文件选择处理函数 - 使用 Zustand store
	const handleFileSelect = useCallback((file: FileInfo | null) => {
		if (file) {
			selectFile(file);
			// 检查并创建会话
			checkAndCreateConversation([file]);
		}
	}, [selectFile, checkAndCreateConversation]);



	return (
		<div className="h-screen bg-base-100 flex overflow-hidden">
			{/* 左侧区域 - 包含标题和文件面板 - 响应式宽度 */}
			<div className="w-80 lg:w-96 xl:w-[28rem] 2xl:w-[32rem] bg-base-200 border-r border-base-300 flex-shrink-0 flex flex-col">
				{/* 左上角标题区域 */}
				<div className="bg-base-300 border-b border-base-content/20 p-fluid-md">
					<div className="flex items-center justify-between mb-3">
						<button 
							className="flex items-center space-x-2 hover:bg-base-200 px-3 py-2 rounded-lg transition-colors duration-200 group flex-1"
							onClick={() => setShowAppSettings(true)}
							title="点击打开设置和主题选择"
						>
							<div className="text-fluid-xl group-hover:scale-110 transition-transform duration-200">📊</div>
							<h1 className="text-fluid-xl font-bold text-primary group-hover:text-primary-focus">BuBu</h1>
							<div className="badge badge-primary badge-sm group-hover:badge-primary-focus">Excel AI助手</div>
						</button>
						
						{/* 主题和语言快速切换器 */}
						<div className="flex items-center gap-1">
							<QuickLanguageSwitcher size="sm" className="btn-ghost" />
							<QuickThemeSwitcher size="sm" className="btn-ghost" />
						</div>
					</div>
					
					<div className="text-fluid-xs text-base-content/60">
						🤖一句话处理Excel，Make Excel Easy Again 🖖
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
						onFileSelect={handleFileSelect}
						isProcessingFile={isProcessingFile}
					/>
				</div>
			</div>

			{/* 右侧统一对话界面 */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{selectedFiles.length === 0 ? (
					<div className="flex items-center justify-center h-full bg-base-100">
						<div className="text-center p-fluid-lg">
						<div className="text-fluid-4xl mb-4">📊</div>
						<h3 className="text-fluid-lg font-medium text-base-content mb-2">选择数据源开始分析</h3>
						<p className="text-fluid-base text-base-content/60">请先在左侧选择一个或多个文件作为数据源</p>
					</div>
					</div>
				) : showConversationSelector && currentConversationId === null ? (
					// 统一的会话选择器
					<ConversationSelector
						fileKey={selectedFiles.map(f => f.filename).join(',')}
						fileName={selectedFiles.length === 1 ? selectedFiles[0].filename : `${selectedFiles.length}个文件`}
						selectedFiles={selectedFiles}
						onSelectConversation={(conversationId, messages) => {
							setCurrentConversationId(conversationId);
							// 转换后端消息格式为前端格式
							const convertedMessages = messages.map(msg => ({
								id: msg.id.toString(),
								type: msg.message_type as 'user' | 'assistant' | 'error',
								content: msg.content,
								timestamp: new Date(msg.created_at),
								data: msg.query_result ? JSON.parse(msg.query_result) : undefined,
								insights: msg.insights ? JSON.parse(msg.insights) : undefined,
								suggestions: msg.suggestions ? JSON.parse(msg.suggestions) : undefined,
								debugInfo: parseDebugInfo(msg.debug_info || '')
							}));
							console.log('🔧 [DEBUG] 转换后的消息:', convertedMessages);
							setCurrentMessages(convertedMessages);
							setShowConversationSelector(false);
						}}
						onCreateNewConversation={(conversationId) => {
							setCurrentConversationId(conversationId);
							setCurrentMessages([]);
							setShowConversationSelector(false);
						}}
					/>
				) : (
					<ConversationInterface
						onQuery={processQuery}
						loading={isLoading}
						conversations={currentMessages.length > 0 ? currentMessages : conversations}
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
			<DataProvider>
				<AppContent />
			</DataProvider>
		</NotificationProvider>
	);
}

export default App;
