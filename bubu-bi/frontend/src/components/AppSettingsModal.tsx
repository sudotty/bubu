import React, { useState, useEffect, memo } from 'react';
import type { SystemInfo } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { GetSystemInfo, ExecuteCommand } from '../../wailsjs/go/main/App';
import { ThemeSelector } from './ThemeSelector';
import { LanguageSelector } from './LanguageSelector';
import { useI18n } from '../hooks/useI18n';

interface AppSettingsModalProps {
	onClose: () => void;
}

interface Theme {
	value: string;
	label: string;
	icon: string;
	category: string;
}

const AppSettingsModal = memo<AppSettingsModalProps>(({ onClose }) => {
	const [activeTab, setActiveTab] = useState<'theme' | 'language' | 'settings'>('theme');
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const { t } = useI18n();



	// 获取系统信息
	useEffect(() => {
		const loadSystemInfo = async () => {
			try {
				const info = await GetSystemInfo();
				setSystemInfo(info);
			} catch (error) {
				console.error('获取系统信息失败:', error);
			} finally {
				setLoading(false);
			}
		};

		loadSystemInfo();
	}, []);



	// 打开文件夹
	const openFolder = async (path: string) => {
		try {
			if (navigator.userAgent.includes('Mac')) {
				await ExecuteCommand('open', [path]);
			} else if (navigator.userAgent.includes('Win')) {
				await ExecuteCommand('explorer', [path]);
			} else {
				await ExecuteCommand('xdg-open', [path]);
			}
		} catch (error) {
			console.error('打开文件夹失败:', error);
			alert('无法打开文件夹，请手动访问路径');
		}
	};

	return (
		<div className="modal modal-open">
			<div className="modal-box w-11/12 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
				{/* 弹窗头部 */}
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center space-x-3">
						<div className="text-xl">📊</div>
						<div>
							<h3 className="font-bold text-base">{t('common.settings') || 'BuBu 设置'}</h3>
						</div>
					</div>
					<button
						type="button"
						className="btn btn-sm btn-circle btn-ghost"
						onClick={onClose}
					>
						✕
					</button>
				</div>

				{/* 标签页导航 */}
				<div className="tabs tabs-boxed mb-3">
					<button
						type="button"
						className={`tab ${activeTab === 'theme' ? 'tab-active' : ''}`}
						onClick={() => setActiveTab('theme')}
					>
						🎨 {t('theme.theme') || '主题'}
					</button>
					<button
						type="button"
						className={`tab ${activeTab === 'language' ? 'tab-active' : ''}`}
						onClick={() => setActiveTab('language')}
					>
						🌐 {t('language.language') || '语言'}
					</button>
					<button
						type="button"
						className={`tab ${activeTab === 'settings' ? 'tab-active' : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						⚙️ {t('common.settings') || '设置'}
					</button>
				</div>

				{/* 内容区域 */}
				<div className="flex-1 overflow-y-auto">
					{activeTab === 'theme' && (
						<ThemeSelector 
							mode="list"
							showPreview={true}
							showDescription={true}
							groupByCategory={true}
							className=""
						/>
					)}
					
					{activeTab === 'language' && (
						<LanguageSelector 
							mode="list"
							showFlag={true}
							showNativeName={true}
							showEnglishName={true}
							className=""
						/>
					)}

					{activeTab === 'settings' && (
						<div className="space-y-4">
							{/* 系统信息 */}
							<div>
								<h3 className="text-sm font-medium mb-2">📊 系统信息</h3>
								<div className="bg-base-200 p-3 rounded-lg">
									<div className="grid grid-cols-2 gap-3 text-xs">
										<div className="flex justify-between">
											<span>产品:</span>
											<span className="font-medium">BuBu v1.0.0</span>
										</div>
										<div className="flex justify-between">
											<span>AI引擎:</span>
											<span className="font-medium">火山引擎</span>
										</div>
										<div className="flex justify-between">
											<span>状态:</span>
											<span className="badge badge-success badge-xs">已连接</span>
										</div>
									</div>
								</div>
							</div>

							{/* 存储路径信息 */}
							<div>
								<h3 className="text-sm font-medium mb-2">💾 存储路径</h3>
								{loading ? (
									<div className="bg-base-200 p-3 rounded-lg">
										<div className="flex items-center justify-center">
											<span className="loading loading-spinner loading-sm mr-2"></span>
											<span className="text-xs">加载中...</span>
										</div>
									</div>
								) : systemInfo ? (
									<div className="bg-base-200 p-3 rounded-lg space-y-2">
										{/* 上传文件路径 */}
										<div>
											<div className="flex justify-between items-center text-xs mb-1">
												<span className="font-medium">📁 上传文件</span>
												<span className="text-base-content/70">{formatFileSize(systemInfo.upload_size)}</span>
											</div>
											<div className="flex items-center space-x-1">
												<code className="text-xs bg-base-300 px-1.5 py-0.5 rounded flex-1 truncate" title={systemInfo.upload_path}>
													{systemInfo.upload_path}
												</code>
												<button 
													className="btn btn-ghost btn-xs px-1" 
													onClick={() => openFolder(systemInfo.upload_path)}
													title="打开文件夹"
												>
													📂
												</button>
											</div>
										</div>
										{/* 数据库文件路径 */}
										<div>
											<div className="flex justify-between items-center text-xs mb-1">
												<span className="font-medium">🗄️ 数据库</span>
												<span className="text-base-content/70">{formatFileSize(systemInfo.database_size)}</span>
											</div>
											<div className="flex items-center space-x-1">
												<code className="text-xs bg-base-300 px-1.5 py-0.5 rounded flex-1 truncate" title={systemInfo.database_path}>
													{systemInfo.database_path}
												</code>
												<button 
													className="btn btn-ghost btn-xs px-1" 
													onClick={() => {
														const folderPath = systemInfo.database_path.substring(0, systemInfo.database_path.lastIndexOf('/'));
														openFolder(folderPath);
													}}
													title="打开文件夹"
												>
													📂
												</button>
											</div>
										</div>
									</div>
								) : (
									<div className="bg-base-200 p-3 rounded-lg">
										<span className="text-xs text-base-content/70">无法获取存储路径信息</span>
									</div>
								)}
							</div>

							{/* 功能说明 */}
							<div>
								<h3 className="text-sm font-medium mb-2">🚀 核心功能</h3>
								<div className="grid grid-cols-2 gap-1.5 text-xs">
									<div className="flex items-center space-x-1">
										<span className="badge badge-primary badge-xs">🗣️</span>
										<span>自然语言查询</span>
									</div>
									<div className="flex items-center space-x-1">
										<span className="badge badge-secondary badge-xs">📊</span>
										<span>智能分析</span>
									</div>
									<div className="flex items-center space-x-1">
										<span className="badge badge-accent badge-xs">🔧</span>
										<span>组件管理</span>
									</div>
									<div className="flex items-center space-x-1">
										<span className="badge badge-info badge-xs">📁</span>
										<span>Excel处理</span>
									</div>
								</div>
							</div>

							{/* 使用提示 */}
							<div>
								<h3 className="text-sm font-medium mb-2">💡 使用提示</h3>
								<div className="bg-base-200 p-2.5 rounded-lg text-xs space-y-0.5">
									<p>• 使用自然语言描述需求，AI自动生成SQL</p>
									<p>• 可预览编辑生成的SQL语句</p>
									<p>• 查询结果可保存为可复用组件</p>
									<p>• 支持Excel文件上传和数据分析</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			<div className="modal-backdrop" onClick={onClose}></div>
		</div>
	);
});

AppSettingsModal.displayName = 'AppSettingsModal';

export default AppSettingsModal;