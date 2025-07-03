import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GetUploadedFiles } from '../wailsjs/go/main/App';
import FilePanel from './components/FilePanel';
import ConversationInterface from './components/ConversationInterface';
import { ConversationSelector } from './components/ConversationSelector';
import AppSettingsModal from './components/AppSettingsModal';
import { useConversationQuery } from './hooks/useConversationQuery';
import { GetConversationsByFiles, CreateConversation } from '../wailsjs/go/main/App';
import { parseDebugInfo } from './types/debug';
import { DataProvider } from './context/DataContext';
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
	const [showConversationSelector, setShowConversationSelector] = useState(false);

	// 检查并创建会话的函数
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
	const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
	const [currentMessages, setCurrentMessages] = useState<any[]>([]);
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
			{/* 左侧区域 - 包含标题和文件面板 - 响应式宽度 */}
			<div className="w-80 lg:w-96 xl:w-[28rem] 2xl:w-[32rem] bg-base-200 border-r border-base-300 flex-shrink-0 flex flex-col">
				{/* 左上角标题区域 */}
				<div className="bg-base-300 border-b border-base-content/20 p-fluid-md">
					<button 
						className="flex items-center space-x-2 hover:bg-base-200 px-3 py-2 rounded-lg transition-colors duration-200 group w-full"
						onClick={() => setShowAppSettings(true)}
						title="点击打开设置和主题选择"
					>
						<div className="text-fluid-xl group-hover:scale-110 transition-transform duration-200">📊</div>
						<h1 className="text-fluid-xl font-bold text-primary group-hover:text-primary-focus">BuBu</h1>
						<div className="badge badge-primary badge-sm group-hover:badge-primary-focus">Excel AI助手</div>
					</button>
					<div className="mt-2 text-fluid-xs text-base-content/60">
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
						onFileSelect={(file) => {
				if (!file) return;
				if (selectedFiles.some(f => f.filename === file.filename && f.file_path === file.file_path)) {
					// 如果文件已选中，则取消选择
					setSelectedFiles(prev => {
						const newSelection = prev.filter(f => !(f.filename === file.filename && f.file_path === file.file_path));
						// 如果没有选中的文件了，隐藏会话选择器
						if (newSelection.length === 0) {
							setShowConversationSelector(false);
							setCurrentConversationId(null);
							setCurrentMessages([]);
						}
						return newSelection;
					});
				} else {
					// 如果文件未选中，则添加到选择列表
					setSelectedFiles(prev => {
						const newSelection = [...prev, file];
						// 检查是否有历史会话，没有则自动创建新会话
						checkAndCreateConversation(newSelection);
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
