import { memo, useEffect, useState } from 'react';

interface ThemeSelectorProps {
	className?: string;
}

interface Theme {
	value: string;
	label: string;
	icon: string;
	category: string;
}

const ThemeSelector = memo<ThemeSelectorProps>(({ className = '' }) => {
	const [currentTheme, setCurrentTheme] = useState<string>('light');
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

	// DaisyUI 35个内置主题选项（中文名称和分类）
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
		applyTheme(savedTheme);
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
		setIsModalOpen(false); // 选择主题后关闭弹窗
	};

	// 按分类分组主题
	const groupedThemes = themes.reduce((acc, theme) => {
		if (!acc[theme.category]) {
			acc[theme.category] = [];
		}
		acc[theme.category].push(theme);
		return acc;
	}, {} as Record<string, Theme[]>);

	// 打开弹窗
	const openModal = () => {
		setIsModalOpen(true);
	};

	// 关闭弹窗
	const closeModal = () => {
		setIsModalOpen(false);
	};

	return (
		<>
			{/* 主题选择按钮 */}
			<button
				type="button"
				className={`btn btn-ghost btn-sm gap-2 ${className}`}
				onClick={openModal}
			>
				<span className="text-lg">
					{themes.find(t => t.value === currentTheme)?.icon || '✨'}
				</span>
				<span className="hidden sm:inline">
					{themes.find(t => t.value === currentTheme)?.label || '浅色'}
				</span>
				<svg
					width="12px"
					height="12px"
					className="inline-block h-2 w-2 fill-current opacity-60"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 2048 2048"
				>
					<path d="m1799 349 242 241-1017 1017L7 590l242-241 775 775 775-775z" />
				</svg>
			</button>

			{/* 主题选择弹窗 */}
			{isModalOpen && (
				<div className="modal modal-open">
				<div className="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
						{/* 弹窗头部 */}
						<div className="flex items-center justify-between mb-4">
							<div>
								<h3 className="font-bold text-lg">选择主题</h3>
								<p className="text-sm text-base-content/70 mt-1">从 {themes.length} 个精美主题中选择您喜欢的风格</p>
							</div>
							<button
								type="button"
								className="btn btn-sm btn-circle btn-ghost"
								onClick={closeModal}
							>
								✕
							</button>
						</div>

						{/* 主题网格 */}
						<div className="flex-1 overflow-y-auto">
							{Object.entries(groupedThemes).map(([category, categoryThemes]) => (
								<div key={category} className="mb-6">
									<h4 className="font-semibold text-sm mb-3 text-base-content/80 border-b border-base-300 pb-1">
										{category} ({categoryThemes.length})
									</h4>
									<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
										{categoryThemes.map((theme) => (
											<button
												key={theme.value}
												type="button"
												className={`
													card card-compact bg-base-100 shadow-sm hover:shadow-md transition-all duration-200
													border-2 hover:scale-105 cursor-pointer
													${currentTheme === theme.value 
														? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
														: 'border-base-300 hover:border-primary/50'
													}
												`}
												onClick={() => handleThemeChange(theme.value)}
											>
												<div className="card-body items-center text-center p-3">
													<div className="text-xl mb-1">{theme.icon}</div>
													<div className="text-xs font-medium">{theme.label}</div>
													{currentTheme === theme.value && (
														<div className="absolute top-1 right-1 text-primary">
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
					</div>
					<div className="modal-backdrop" onClick={closeModal}></div>
				</div>
			)}
		</>
	);
});

ThemeSelector.displayName = 'ThemeSelector';

export default ThemeSelector;