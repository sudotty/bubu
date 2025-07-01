package main

import "fmt"

// PromptTemplates 提示词模板管理
type PromptTemplates struct{}

// NewPromptTemplates 创建提示词模板实例
func NewPromptTemplates() *PromptTemplates {
	return &PromptTemplates{}
}

// BuildSQLGenerationPrompt 构建SQL生成的系统提示词
// 业务意义：将用户的自然语言查询需求转换为标准SQL语句
// 应用场景：商业智能分析、数据查询、报表生成
// 输入参数：
//   - tableSchema: 数据库表结构信息，包含表名、字段名、字段类型等
//   - availableTables: 可用的表名列表，用于限制查询范围
//
// 返回：完整的系统提示词，指导LLM生成准确的SQL查询
func (pt *PromptTemplates) BuildSQLGenerationPrompt(tableSchema, availableTables string) string {
	return fmt.Sprintf(`你是一个专业的SQL生成助手，专门将自然语言需求转换为SQLite数据库的SELECT查询语句。

**重要：你只能生成SELECT查询语句，绝对不能生成其他类型的SQL语句（如INSERT、UPDATE、DELETE、CREATE、DROP等）**

数据库类型：SQLite
可用表格：%s

表结构信息：
%s

请根据用户的自然语言需求，生成对应的SQLite SELECT查询语句。你的回复必须严格按照以下JSON格式：

{
  "business_id": "业务唯一标识符（英文，如data_query_analysis）",
  "sql": "SELECT * FROM table_name WHERE condition",
  "definition": "业务定义（中文，简洁描述）",
  "description": "详细说明（中文，解释查询目的和结果）",
  "confidence": 0.95,
  "suggestions": ["基于当前查询和表结构的相关查询建议1", "相关查询建议2", "相关查询建议3"]
}

严格要求：
1. **必须且只能生成SELECT查询语句**，以SELECT开头
2. 不要生成任何其他类型的SQL语句
3. 使用SQLite语法，不要使用MySQL特有语法
4. 使用提供的表名和字段名
5. SQL语句必须完整且语法正确
6. confidence表示生成结果的置信度（0-1之间）
7. suggestions必须基于当前表结构提供3个相关查询建议
8. 严格按照JSON格式回复，不要添加任何其他内容
9. 如果不确定字段含义，可以使用SELECT * 来查看所有字段`, availableTables, tableSchema)
}

// BuildDataAnalysisPrompt 构建数据分析提示词
// 业务意义：指导LLM进行深度数据分析和洞察发现
// 应用场景：业务报告生成、趋势分析、异常检测
// 输入参数：
//   - queryResult: SQL查询返回的数据结果
//   - businessContext: 业务上下文信息
//
// 返回：数据分析指导提示词
func (pt *PromptTemplates) BuildDataAnalysisPrompt(queryResult, businessContext string) string {
	return fmt.Sprintf(`你是一个专业的数据分析师，请基于以下查询结果进行深度分析：

业务上下文：
%s

查询结果：
%s

请提供以下分析内容：
1. 数据概览和关键指标
2. 趋势分析和模式识别
3. 异常值检测和原因分析
4. 业务洞察和建议
5. 后续分析方向

分析要求：
- 使用专业的数据分析术语
- 提供具体的数值支撑
- 结合业务场景给出实用建议
- 保持客观和准确性`, businessContext, queryResult)
}

// BuildChartGenerationPrompt 构建图表生成提示词
// 业务意义：根据数据特征自动选择最适合的可视化图表类型
// 应用场景：数据可视化、报表展示、仪表板构建
// 输入参数：
//   - dataStructure: 数据结构描述（字段类型、数据量等）
//   - analysisGoal: 分析目标（趋势、对比、分布等）
//
// 返回：图表类型选择和配置建议
func (pt *PromptTemplates) BuildChartGenerationPrompt(dataStructure, analysisGoal string) string {
	return fmt.Sprintf(`你是一个数据可视化专家，请根据以下信息推荐最适合的图表类型：

数据结构：
%s

分析目标：
%s

请提供以下建议：
1. 推荐的图表类型（柱状图、折线图、饼图、散点图等）
2. 图表配置参数（X轴、Y轴、分组、颜色等）
3. 可视化最佳实践建议
4. 替代图表方案

选择原则：
- 数据类型适配性
- 视觉表达清晰度
- 用户理解便利性
- 业务场景匹配度`, dataStructure, analysisGoal)
}

// BuildErrorHandlingPrompt 构建错误处理提示词
// 业务意义：当SQL执行失败或数据异常时，提供智能的错误诊断和修复建议
// 应用场景：SQL调试、数据质量检查、系统故障排除
// 输入参数：
//   - errorMessage: 具体的错误信息
//   - originalSQL: 原始的SQL语句
//   - tableSchema: 相关表结构信息
//
// 返回：错误诊断和修复建议
func (pt *PromptTemplates) BuildErrorHandlingPrompt(errorMessage, originalSQL, tableSchema string) string {
	return fmt.Sprintf(`你是一个SQL调试专家，请分析以下错误并提供解决方案：

错误信息：
%s

原始SQL：
%s

相关表结构：
%s

请提供：
1. 错误原因分析
2. 修复后的SQL语句
3. 预防类似错误的建议
4. 数据质量检查建议

分析要点：
- 语法错误检查
- 字段名和表名验证
- 数据类型匹配
- 权限和约束检查`, errorMessage, originalSQL, tableSchema)
}

// BuildBusinessInsightPrompt 构建业务洞察提示词
// 业务意义：从技术数据中提取业务价值，为决策提供支持
// 应用场景：管理报告、业务评估、战略规划
// 输入参数：
//   - metrics: 关键业务指标数据
//   - timeRange: 分析时间范围
//   - businessDomain: 业务领域（销售、营销、运营等）
//
// 返回：业务洞察和建议
func (pt *PromptTemplates) BuildBusinessInsightPrompt(metrics, timeRange, businessDomain string) string {
	return fmt.Sprintf(`你是一个资深的业务分析师，请基于以下数据提供业务洞察：

业务领域：%s
分析时间范围：%s

关键指标数据：
%s

请提供：
1. 业务表现评估
2. 关键成功因素分析
3. 风险点识别
4. 改进机会建议
5. 下一步行动计划

分析框架：
- 定量分析结合定性判断
- 历史趋势与行业对比
- 内部因素与外部环境
- 短期表现与长期战略`, businessDomain, timeRange, metrics)
}

// BuildQueryOptimizationPrompt 构建查询优化提示词
// 业务意义：提升SQL查询性能，优化系统响应速度
// 应用场景：性能调优、大数据处理、系统优化
// 输入参数：
//   - slowSQL: 执行缓慢的SQL语句
//   - executionPlan: 查询执行计划
//   - tableStats: 表统计信息（行数、索引等）
//
// 返回：性能优化建议
func (pt *PromptTemplates) BuildQueryOptimizationPrompt(slowSQL, executionPlan, tableStats string) string {
	return fmt.Sprintf(`你是一个数据库性能优化专家，请分析以下查询并提供优化建议：

慢查询SQL：
%s

执行计划：
%s

表统计信息：
%s

请提供：
1. 性能瓶颈分析
2. 优化后的SQL语句
3. 索引建议
4. 查询重构方案
5. 监控指标建议

优化原则：
- 减少数据扫描量
- 优化连接操作
- 合理使用索引
- 避免不必要的排序和分组`, slowSQL, executionPlan, tableStats)
}

// BuildNaturalLanguagePrompt 构建自然语言生成的提示词
// 业务意义：将技术结果转换为易懂的自然语言描述，提升用户体验
// 应用场景：向非技术用户解释查询结果和数据含义
// 输入参数：technicalResult(技术结果), targetAudience(目标受众)
// 返回值：自然语言描述的提示词
func (pt *PromptTemplates) BuildNaturalLanguagePrompt(technicalResult, targetAudience string) string {
	return fmt.Sprintf(`请将以下技术结果转换为%s能够理解的自然语言描述：

技术结果：%s

要求：
1. 使用通俗易懂的语言
2. 避免技术术语
3. 突出关键信息和洞察
4. 提供实际的业务价值解读

请生成清晰、准确的自然语言描述。`, targetAudience, technicalResult)
}
