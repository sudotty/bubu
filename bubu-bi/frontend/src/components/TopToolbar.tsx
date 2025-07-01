import { memo } from 'react';
import ThemeSelector from './ThemeSelector';

interface TopToolbarProps {
	onRefresh: () => void;
	onOpenSettings: () => void;
}

const TopToolbar = memo<TopToolbarProps>(({ onRefresh, onOpenSettings }) => {


	return (
		<div className="bg-base-300 border-b border-base-content/20 px-4 py-3">
			<div className="flex items-center justify-between">
				{/* 左侧 - 应用标题和主要功能 */}
				<div className="flex items-center space-x-6">
					<div className="flex items-center space-x-2">
						<div className="text-2xl">📊</div>
						<h1 className="text-xl font-bold text-primary">Excel AI助手</h1>
						<div className="badge badge-primary badge-sm">让数据分析变得简单</div>
					</div>
				</div>

				{/* 右侧 - 工具和操作 */}
				<div className="flex items-center space-x-3">
					{/* 快速操作按钮 */}
					<div className="flex items-center space-x-2">
						<button
							className="btn btn-ghost btn-sm"
							onClick={onRefresh}
							title="刷新数据"
						>
							🔄
						</button>

						<ThemeSelector />

						<button
							className="btn btn-ghost btn-sm"
							onClick={onOpenSettings}
							title="系统设置"
						>
							⚙️ 设置
						</button>
					</div>
				</div>
			</div>

			{/* 当前状态指示器 */}
			<div className="mt-2 flex items-center justify-between text-xs text-base-content/60">
				<div className="flex items-center space-x-4">
					<span>
						🤖 用自然语言描述需求，AI智能完成Excel数据分析
					</span>
				</div>
				<div className="flex items-center space-x-2">
					<div className="w-2 h-2 bg-success rounded-full"></div>
					<span>本地处理，数据安全</span>
				</div>
			</div>
		</div>
	);
});

TopToolbar.displayName = 'TopToolbar';

export default TopToolbar;
