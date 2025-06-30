import { memo, useEffect, useState } from 'react';

interface ThemeSelectorProps {
	className?: string;
}

const ThemeSelector = memo<ThemeSelectorProps>(({ className = '' }) => {
	const [currentTheme, setCurrentTheme] = useState<string>('light');

	// DaisyUI 35个内置主题选项（中文名称）
	const themes = [
		{ value: 'light', label: '浅色', icon: '☀️' },
		{ value: 'dark', label: '深色', icon: '🌙' },
		{ value: 'cupcake', label: '纸杯蛋糕', icon: '🧁' },
		{ value: 'bumblebee', label: '大黄蜂', icon: '🐝' },
		{ value: 'emerald', label: '翡翠', icon: '💎' },
		{ value: 'corporate', label: '企业', icon: '🏢' },
		{ value: 'synthwave', label: '合成波', icon: '🌊' },
		{ value: 'retro', label: '复古', icon: '📻' },
		{ value: 'cyberpunk', label: '赛博朋克', icon: '🤖' },
		{ value: 'valentine', label: '情人节', icon: '💝' },
		{ value: 'halloween', label: '万圣节', icon: '🎃' },
		{ value: 'garden', label: '花园', icon: '🌸' },
		{ value: 'forest', label: '森林', icon: '🌲' },
		{ value: 'aqua', label: '水蓝', icon: '🌊' },
		{ value: 'lofi', label: 'Lo-Fi', icon: '🎵' },
		{ value: 'pastel', label: '粉彩', icon: '🎨' },
		{ value: 'fantasy', label: '幻想', icon: '🦄' },
		{ value: 'wireframe', label: '线框', icon: '📐' },
		{ value: 'black', label: '黑色', icon: '⚫' },
		{ value: 'luxury', label: '奢华', icon: '💎' },
		{ value: 'dracula', label: '德古拉', icon: '🧛' },
		{ value: 'cmyk', label: 'CMYK', icon: '🖨️' },
		{ value: 'autumn', label: '秋季', icon: '🍂' },
		{ value: 'business', label: '商务', icon: '💼' },
		{ value: 'acid', label: '酸性', icon: '🧪' },
		{ value: 'lemonade', label: '柠檬水', icon: '🍋' },
		{ value: 'night', label: '夜晚', icon: '🌃' },
		{ value: 'coffee', label: '咖啡', icon: '☕' },
		{ value: 'winter', label: '冬季', icon: '❄️' },
		{ value: 'dim', label: '暗淡', icon: '🔅' },
		{ value: 'nord', label: '北欧', icon: '🏔️' },
		{ value: 'sunset', label: '日落', icon: '🌅' },
		{ value: 'caramellatte', label: '焦糖拿铁', icon: '🥛' },
		{ value: 'abyss', label: '深渊', icon: '🕳️' },
		{ value: 'silk', label: '丝绸', icon: '🧵' },
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
	};

	return (
		<div className={`dropdown dropdown-end ${className}`}>
			<div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2">
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
			</div>
			<ul
				tabIndex={0}
				className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300"
			>
				{themes.map((theme) => (
					<li key={theme.value}>
						<button
							type="button"
							className={`flex items-center gap-3 ${
								currentTheme === theme.value ? 'active bg-primary/10 text-primary' : ''
							}`}
							onClick={() => handleThemeChange(theme.value)}
						>
							<span className="text-lg">{theme.icon}</span>
							<span>{theme.label}</span>
							{currentTheme === theme.value && (
								<span className="ml-auto text-primary">✓</span>
							)}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
});

ThemeSelector.displayName = 'ThemeSelector';

export default ThemeSelector;