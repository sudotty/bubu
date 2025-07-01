import React, { memo, useState, useEffect } from 'react';
import type { SystemInfo } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { GetSystemInfo, ExecuteCommand } from '../../wailsjs/go/main/App';

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
	const [activeTab, setActiveTab] = useState<'theme' | 'settings'>('theme');
	const [currentTheme, setCurrentTheme] = useState<string>('light');
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [loading, setLoading] = useState(true);

	// DaisyUI 35个内置主题选项
	const themes: Theme[] = [
		{ value: 'light', label: '浅色', icon: '☀️', category: '基础' },
		{ value: 'dark', label: '深色', icon: '🌙', category: '基础' },
		{ value: 'cupcake', label: '纸杯蛋糕', icon: '🧁', category: '可爱' },
		{ value: 'bumblebee', label: '大黄蜂', icon: '🐝', category: '自然' },
		{ value: 'emerald', label: '翡翠', icon: '💚', category: '自然' },
		{ value: 'corporate', label: '企业', icon: '🏢', category: '商务' },
		{ value: 'synthwave', label: '合成波', icon: '🎛️', category: '科技' },
		{ value: 'retro', label: '复古', icon: '📻', category: '复古' },
		{ value: 'cyberpunk', label: '赛博朋克', icon: '🤖', category: '科技' },
		{ value: 'valentine', label: '情人节', icon: '💝', category: '节日' },
		{ value: 'halloween', label: '万圣节', icon: '🎃', category: '节日' },
		{ value: 'garden', label: '花园', icon: '🌺', category: '自然' },
		{ value: 'forest', label: '森林', icon: '🌲', category: '自然' },
		{ value: 'aqua', label: '水蓝', icon: '💧', category: '自然' },
		{ value: 'lofi', label: 'Lo-Fi', icon: '🎧', category: '艺术' },
		{ value: 'pastel', label: '粉彩', icon: '🎨', category: '艺术' },
		{ value: 'fantasy', label: '幻想', icon: '🦄', category: '艺术' },
		{ value: 'wireframe', label: '线框', icon: '📐', category: '极简' },
		{ value: 'black', label: '黑色', icon: '⚫', category: '极简' },
		{ value: 'luxury', label: '奢华', icon: '✨', category: '高端' },
		{ value: 'dracula', label: '德古拉', icon: '🧛', category: '暗黑' },
		{ value: 'cmyk', label: 'CMYK', icon: '🖨️', category: '专业' },
		{ value: 'autumn', label: '秋季', icon: '🍂', category: '季节' },
		{ value: 'business', label: '商务', icon: '💼', category: '商务' },
		{ value: 'acid', label: '酸性', icon: '🧪', category: '科技' },
		{ value: 'lemonade', label: '柠檬水', icon: '🍋', category: '清新' },
		{ value: 'night', label: '夜晚', icon: '🌃', category: '暗黑' },
		{ value: 'coffee', label: '咖啡', icon: '☕', category: '温馨' },
		{ value: 'winter', label: '冬季', icon: '❄️', category: '季节' },
		{ value: 'dim', label: '暗淡', icon: '🔅', category: '暗黑' },
		{ value: 'nord', label: '北欧', icon: '🏔️', category: '极简' },
		{ value: 'sunset', label: '日落', icon: '🌅', category: '温馨' },
		{ value: 'caramellatte', label: '焦糖拿铁', icon: '🥛', category: '温馨' },
		{ value: 'abyss', label: '深渊', icon: '🕳️', category: '暗黑' },
		{ value: 'silk', label: '丝绸', icon: '🧵', category: '高端' },
	];

	// 初始化主题
	useEffect(() => {
		const savedTheme = localStorage.getItem('theme') || 'light';
		setCurrentTheme(savedTheme);
	}, []);

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

	// 应用主题
	const applyTheme = (theme: string) => {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	};

	// 切换主题
	const handleThemeChange = (theme: string) => {
		setCurrentTheme(theme);
		applyTheme(theme);
		// 选中主题后自动关闭modal
		setTimeout(() => {
			onClose();
		}, 300); // 延迟300ms让用户看到选中效果
	};

	// 按分类分组主题
	const groupedThemes = themes.reduce((acc, theme) => {
		if (!acc[theme.category]) {
			acc[theme.category] = [];
		}
		acc[theme.category].push(theme);
		return acc;
	}, {} as Record<string, Theme[]>);

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
							<h3 className="font-bold text-base">BuBu 设置</h3>
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
						className={`tab flex-1 ${activeTab === 'theme' ? 'tab-active' : ''}`}
						onClick={() => setActiveTab('theme')}
					>
						🎨 主题
					</button>
					<button
						type="button"
						className={`tab flex-1 ${activeTab === 'settings' ? 'tab-active' : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						⚙️ 设置
					</button>
				</div>

				{/* 内容区域 */}
				<div className="flex-1 overflow-y-auto">
					{activeTab === 'theme' && (
						<div>
							{/* 当前主题显示 */}
							<div className="mb-4 p-3 bg-base-200 rounded-lg">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium text-sm">当前主题</h4>
									</div>
									<div className="flex items-center space-x-2">
										<span className="text-lg">{themes.find(t => t.value === currentTheme)?.icon || '✨'}</span>
										<span className="text-sm font-medium">{themes.find(t => t.value === currentTheme)?.label || '浅色'}</span>
									</div>
								</div>
							</div>

							{/* 主题网格 */}
							{Object.entries(groupedThemes).map(([category, categoryThemes]) => (
								<div key={category} className="mb-4">
									<h4 className="font-medium text-xs mb-2 text-base-content/70 border-b border-base-300 pb-1">
										{category}
									</h4>
									<div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
										{categoryThemes.map((theme) => (
											<button
												key={theme.value}
												type="button"
												className={`
													relative bg-base-100 hover:bg-base-200 transition-all duration-200
													border-2 hover:scale-105 cursor-pointer rounded-lg p-2
													${currentTheme === theme.value 
														? 'border-primary bg-primary/10 ring-1 ring-primary/30' 
														: 'border-base-300 hover:border-primary/50'
													}
												`}
												onClick={() => handleThemeChange(theme.value)}
												title={theme.label}
											>
												<div className="flex flex-col items-center">
													<div className="text-base mb-0.5">{theme.icon}</div>
													<div className="text-xs font-medium truncate">{theme.label}</div>
													{currentTheme === theme.value && (
														<div className="absolute -top-0.5 -right-0.5 text-primary">
															<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
															</svg>
														</div>
													)}
												</div>
											</button>
										))}
									</div>
								</div>
							))}
						</div>
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