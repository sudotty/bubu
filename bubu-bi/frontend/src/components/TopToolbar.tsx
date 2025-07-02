import React, { memo } from 'react';

interface TopToolbarProps {
	onRefresh: () => void;
	onOpenAppSettings: () => void;
}

const TopToolbar = memo<TopToolbarProps>(({ onRefresh, onOpenAppSettings }) => {


	return (
		<div className="bg-base-300 border-b border-base-content/20 px-4 py-3">
			<div className="flex items-center justify-between">
				{/* 左侧 - 应用标题和主要功能 */}
				<div className="flex items-center space-x-6">
					<button 
						className="flex items-center space-x-2 hover:bg-base-200 px-3 py-2 rounded-lg transition-colors duration-200 group"
						onClick={onOpenAppSettings}
						title="点击打开设置和主题选择"
					>
						<div className="text-2xl group-hover:scale-110 transition-transform duration-200">📊</div>
						<h1 className="text-xl font-bold text-primary group-hover:text-primary-focus">BuBu</h1>
						<div className="badge badge-primary badge-sm group-hover:badge-primary-focus">Excel AI助手</div>
					</button>
				</div>

				{/* 右侧 - 预留空间 */}
				<div className="flex items-center space-x-3">
					{/* 可以在这里添加其他功能按钮 */}
				</div>
			</div>

			{/* 当前状态指示器 */}
			<div className="mt-2 flex items-center text-xs text-base-content/60">
				<div className="flex items-center space-x-4">
					<span>
						🤖一句话处理Excel，Make Excel Easy Again🖖
					</span>
				</div>
			</div>
		</div>
	);
});

TopToolbar.displayName = 'TopToolbar';

export default TopToolbar;
