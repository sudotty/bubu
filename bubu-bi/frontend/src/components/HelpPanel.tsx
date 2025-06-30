import { memo } from 'react';

interface HelpPanelProps {
	onClose: () => void;
}

const HelpPanel = memo<HelpPanelProps>(({ onClose }) => {
	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-base-100 rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-y-auto border border-base-300">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-base-content">📖 使用指南</h2>
					<button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
						✕
					</button>
				</div>

				<div className="space-y-6">
					{/* 快速开始 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-primary">
							🚀 快速开始
						</h3>
						<div className="space-y-2 text-sm text-base-content">
							<div className="flex items-start space-x-2">
								<span className="text-primary font-bold">1.</span>
								<span>点击右上角"⚙️ 设置"按钮，配置火山引擎LLM API密钥</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-primary font-bold">2.</span>
								<span>上传Excel或CSV文件到左侧文件面板</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-primary font-bold">3.</span>
								<span>选择要查询的表格，开始使用自然语言描述需求</span>
							</div>
						</div>
					</div>

					{/* 自然语言查询示例 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-success">
							🤖 自然语言查询示例
						</h3>
						<div className="space-y-3">
							<div className="bg-success/10 p-3 rounded-lg border border-success/20">
								<div className="text-sm font-medium text-success mb-1">
									销售数据分析：
								</div>
								<div className="text-sm text-base-content/80">
									"查看销售额排名前10的产品"
								</div>
								<div className="text-sm text-base-content/80">
									"统计每个月的总销售额"
								</div>
								<div className="text-sm text-base-content/80">
									"找出销售额超过10000的订单"
								</div>
							</div>

							<div className="bg-info/10 p-3 rounded-lg border border-info/20">
								<div className="text-sm font-medium text-info mb-1">
									用户数据分析：
								</div>
								<div className="text-sm text-base-content/80">
									"按年龄段统计用户数量"
								</div>
								<div className="text-sm text-base-content/80">
									"查看最近注册的100个用户"
								</div>
								<div className="text-sm text-base-content/80">
									"统计不同城市的用户分布"
								</div>
							</div>

							<div className="bg-secondary/10 p-3 rounded-lg border border-secondary/20">
								<div className="text-sm font-medium text-secondary mb-1">
									库存数据分析：
								</div>
								<div className="text-sm text-base-content/80">
									"查看库存不足的商品"
								</div>
								<div className="text-sm text-base-content/80">
									"统计各类别商品的平均价格"
								</div>
								<div className="text-sm text-base-content/80">
									"找出滞销商品列表"
								</div>
							</div>
						</div>
					</div>

					{/* 组件库功能 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-warning">
							📦 组件库功能
						</h3>
						<div className="space-y-2 text-sm text-base-content">
							<div className="flex items-start space-x-2">
								<span className="text-warning">💾</span>
								<span>
									查询成功后，点击"保存到组件库"按钮可将查询保存为可复用组件
								</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-warning">📚</span>
								<span>点击"组件库"按钮可查看已保存的业务组件和Excel组件</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-warning">🔄</span>
								<span>点击组件可一键复用，自动填充查询内容</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-warning">🏷️</span>
								<span>组件按时间倒序排列，最新保存的组件显示在最上方</span>
							</div>
						</div>
					</div>

					{/* 查询模式 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-accent">
							🔍 查询模式
						</h3>
						<div className="space-y-2 text-sm text-base-content">
							<div className="flex items-start space-x-2">
								<span className="text-accent">🗣️</span>
								<span>
									<strong>自然语言模式（默认）</strong>
									：输入中文描述，AI自动生成SQL查询
								</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-accent">💻</span>
								<span>
									<strong>SQL模式（高级）</strong>：直接编写SQL语句进行查询
								</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-accent">🔄</span>
								<span>两种模式可随时切换，满足不同用户需求</span>
							</div>
						</div>
					</div>

					{/* 安全提示 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-error">
							🛡️ 安全提示
						</h3>
						<div className="space-y-2 text-sm text-base-content">
							<div className="flex items-start space-x-2">
								<span className="text-error">⚠️</span>
								<span>
									系统只支持SELECT查询，自动阻止DELETE、UPDATE等危险操作
								</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-error">🔒</span>
								<span>所有数据处理都在本地进行，确保数据安全</span>
							</div>
							<div className="flex items-start space-x-2">
								<span className="text-error">🔑</span>
								<span>API密钥仅在本地存储，不会上传到任何服务器</span>
							</div>
						</div>
					</div>

					{/* 技术支持 */}
					<div>
						<h3 className="text-md font-semibold mb-3 text-neutral">
							🆘 技术支持
						</h3>
						<div className="space-y-2 text-sm text-base-content/70">
							<div>• 如遇到问题，请检查API密钥是否正确配置</div>
							<div>• 自然语言查询需要网络连接调用火山引擎LLM API</div>
							<div>• 建议使用具体、清晰的中文描述以获得更好的查询结果</div>
							<div>• 复杂查询可以分步骤进行，逐步细化需求</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex justify-end">
					<button onClick={onClose} className="btn btn-primary">
						开始使用
					</button>
				</div>
			</div>
		</div>
	);
});

HelpPanel.displayName = 'HelpPanel';

export default HelpPanel;
