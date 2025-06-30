import React, { useState, useEffect, memo } from 'react';
import type { SystemInfo } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { GetSystemInfo, ExecuteCommand } from '../../wailsjs/go/main/App';

interface SettingsPanelProps {
	onClose: () => void;
}

const SettingsPanel = memo<SettingsPanelProps>(({ onClose }) => {
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [loading, setLoading] = useState(true);

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
			// 使用系统默认程序打开文件夹
			if (navigator.userAgent.includes('Mac')) {
				// macOS
				await ExecuteCommand('open', [path]);
			} else if (navigator.userAgent.includes('Win')) {
				// Windows
				await ExecuteCommand('explorer', [path]);
			} else {
				// Linux
				await ExecuteCommand('xdg-open', [path]);
			}
		} catch (error) {
			console.error('打开文件夹失败:', error);
			alert('无法打开文件夹，请手动访问路径');
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-base-100 rounded-lg p-6 w-96 max-w-md border border-base-300 shadow-xl">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">🔧 系统设置</h2>
					<button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
						✕
					</button>
				</div>

				<div className="space-y-4">
					{/* 系统信息 */}
					<div>
						<h3 className="text-md font-medium mb-3">📊 系统信息</h3>
						<div className="bg-base-200 p-3 rounded-lg space-y-2">
							<div className="flex justify-between text-sm">
								<span>产品名称:</span>
								<span className="font-medium">bubucel</span>
							</div>
							<div className="flex justify-between text-sm">
								<span>版本:</span>
								<span className="font-medium">v1.0.0</span>
							</div>
							<div className="flex justify-between text-sm">
								<span>AI引擎:</span>
								<span className="font-medium">火山引擎 LLM</span>
							</div>
							<div className="flex justify-between text-sm">
								<span>状态:</span>
								<span className="badge badge-success badge-sm">已连接</span>
							</div>
						</div>
					</div>

					{/* 存储路径信息 */}
					<div>
						<h3 className="text-md font-medium mb-3">💾 存储路径</h3>
						{loading ? (
							<div className="bg-base-200 p-3 rounded-lg">
								<div className="flex items-center justify-center">
									<span className="loading loading-spinner loading-sm mr-2"></span>
									<span className="text-sm">加载中...</span>
								</div>
							</div>
						) : systemInfo ? (
							<div className="bg-base-200 p-3 rounded-lg space-y-3">
								{/* 上传文件路径 */}
								<div>
									<div className="flex justify-between items-center text-sm mb-1">
										<span className="font-medium">📁 上传文件:</span>
										<span className="text-xs text-base-content/70">{formatFileSize(systemInfo.upload_size)}</span>
									</div>
									<div className="flex items-center space-x-2">
										<code className="text-xs bg-base-300 px-2 py-1 rounded flex-1 truncate" title={systemInfo.upload_path}>
											{systemInfo.upload_path}
										</code>
										<button 
											className="btn btn-ghost btn-xs" 
											onClick={() => openFolder(systemInfo.upload_path)}
											title="打开文件夹"
										>
											📂
										</button>
									</div>
								</div>
								{/* 数据库文件路径 */}
								<div>
									<div className="flex justify-between items-center text-sm mb-1">
										<span className="font-medium">🗄️ 数据库:</span>
										<span className="text-xs text-base-content/70">{formatFileSize(systemInfo.database_size)}</span>
									</div>
									<div className="flex items-center space-x-2">
										<code className="text-xs bg-base-300 px-2 py-1 rounded flex-1 truncate" title={systemInfo.database_path}>
											{systemInfo.database_path}
										</code>
										<button 
											className="btn btn-ghost btn-xs" 
											onClick={() => {
												// 打开数据库文件所在的文件夹
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
								<span className="text-sm text-base-content/70">无法获取存储路径信息</span>
							</div>
						)}
					</div>

					{/* 功能说明 */}
					<div>
						<h3 className="text-md font-medium mb-3">🚀 核心功能</h3>
						<div className="space-y-2 text-sm">
							<div className="flex items-center space-x-2">
								<span className="badge badge-primary badge-sm">🗣️</span>
								<span>自然语言转SQL查询</span>
							</div>
							<div className="flex items-center space-x-2">
								<span className="badge badge-secondary badge-sm">📊</span>
								<span>智能数据分析</span>
							</div>
							<div className="flex items-center space-x-2">
								<span className="badge badge-accent badge-sm">🔧</span>
								<span>组件化查询管理</span>
							</div>
							<div className="flex items-center space-x-2">
								<span className="badge badge-info badge-sm">📁</span>
								<span>Excel文件处理</span>
							</div>
						</div>
					</div>

					{/* 使用提示 */}
					<div>
						<h3 className="text-md font-medium mb-3">💡 使用提示</h3>
						<div className="bg-base-200 p-3 rounded-lg text-sm space-y-1">
							<p>• 优先使用自然语言模式，AI会自动生成SQL</p>
							<p>• 可以预览和编辑AI生成的SQL语句</p>
							<p>• 查询结果可保存为可复用组件</p>
							<p>• 支持Excel文件上传和数据分析</p>
						</div>
					</div>

					<div className="flex justify-end">
						<button onClick={onClose} className="btn btn-primary">
							关闭
						</button>
					</div>
				</div>
			</div>
		</div>
	);
});

SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel;
