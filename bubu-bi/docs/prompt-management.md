# Prompt 模板管理系统

## 概述

本系统将所有的 AI 提示词（Prompt）集中管理，提供统一的模板生成和错误处理机制，确保 AI 交互的一致性和可维护性。

## 文件结构

### 后端 Prompt 管理

#### `prompts.go`
集中管理后端所有 LLM 提示词模板，包含以下核心功能：

- **SQL 生成提示词** (`BuildSQLGenerationPrompt`)
  - 业务意义：将自然语言需求转换为 SQL 查询语句
  - 应用场景：用户输入自然语言查询时的核心 AI 处理
  - 输出格式：包含 SQL、业务ID、定义、描述、置信度和建议的 JSON

- **数据分析提示词** (`BuildDataAnalysisPrompt`)
  - 业务意义：对查询结果进行深度分析和洞察
  - 应用场景：查询执行后的数据解读和商业价值挖掘

- **图表生成提示词** (`BuildChartGenerationPrompt`)
  - 业务意义：根据数据特征推荐最适合的可视化方案
  - 应用场景：自动化图表类型选择和配置

- **错误处理提示词** (`BuildErrorHandlingPrompt`)
  - 业务意义：智能分析错误原因并提供解决方案
  - 应用场景：SQL 执行失败或数据异常时的问题诊断

- **商业洞察提示词** (`BuildBusinessInsightPrompt`)
  - 业务意义：从技术数据中提取商业价值和决策建议
  - 应用场景：为管理层提供数据驱动的业务洞察

- **查询优化提示词** (`BuildQueryOptimizationPrompt`)
  - 业务意义：分析和优化 SQL 查询性能
  - 应用场景：大数据量查询的性能调优建议

- **自然语言生成提示词** (`BuildNaturalLanguagePrompt`)
  - 业务意义：将技术结果转换为易懂的自然语言描述
  - 应用场景：向非技术用户解释查询结果和数据含义

### 前端 Prompt 管理

#### `promptTemplates.ts`
集中管理前端所有提示词和用户界面文本，包含：

- **数据库结构展示** (`buildDatabaseSchemaPrompt`)
  - 业务意义：向用户清晰展示可用的数据表和字段信息
  - 应用场景：帮助用户了解数据结构，提高查询准确性

- **用户查询上下文** (`buildUserQueryContext`)
  - 业务意义：构建查询的上下文信息，提高 AI 理解准确性
  - 应用场景：多轮对话中保持查询连贯性

- **错误提示信息** (`ERROR_MESSAGES`)
  - 业务意义：提供统一、友好的错误提示，提升用户体验
  - 应用场景：各种异常情况下的用户提示

- **加载状态提示** (`LOADING_MESSAGES`)
  - 业务意义：在处理过程中给用户明确的状态反馈
  - 应用场景：长时间操作的用户体验优化

- **数据洞察模板** (`buildDataInsightPrompt`)
  - 业务意义：根据数据类型和规模生成相应的洞察提示
  - 应用场景：自动化数据分析结果的解读

- **操作建议** (`buildActionSuggestions`)
  - 业务意义：根据当前状态提供下一步操作建议
  - 应用场景：引导用户进行更深入的数据探索

## 使用方法

### 后端使用

```go
// 在 LLMService 中使用
type LLMService struct {
    prompts *PromptTemplates
    // 其他字段...
}

// 初始化
func NewLLMService() *LLMService {
    return &LLMService{
        prompts: NewPromptTemplates(),
    }
}

// 使用提示词模板
systemPrompt := llm.prompts.BuildSQLGenerationPrompt(tableSchema, availableTables)
```

### 前端使用

```typescript
// 导入所需的模板和常量
import { PromptTemplates, ERROR_MESSAGES, COMMON_PROMPTS } from '../utils/promptTemplates';

// 使用数据库结构提示词
const schemaPrompt = PromptTemplates.buildDatabaseSchemaPrompt(tables, schemasMap);

// 使用错误提示
setError(ERROR_MESSAGES.QUERY_FAILED);

// 使用加载提示
setStatus(COMMON_PROMPTS.LOADING);
```

## 设计原则

### 1. 集中管理
- 所有提示词集中在专门的文件中，便于维护和更新
- 避免在业务代码中硬编码提示词文本

### 2. 业务导向
- 每个提示词都有明确的业务意义和应用场景
- 提示词设计考虑用户体验和业务目标

### 3. 类型安全
- 前端使用 TypeScript 确保类型安全
- 后端使用强类型参数和返回值

### 4. 可扩展性
- 模板系统支持参数化配置
- 易于添加新的提示词类型和场景

### 5. 一致性
- 统一的错误处理和用户提示风格
- 保持 AI 交互的一致性体验

## 维护指南

### 添加新的提示词模板

1. **后端添加**：
   ```go
   // 在 prompts.go 中添加新方法
   func (pt *PromptTemplates) BuildNewPrompt(params string) string {
       // 实现提示词逻辑
       return prompt
   }
   ```

2. **前端添加**：
   ```typescript
   // 在 promptTemplates.ts 中添加新方法
   static buildNewPrompt(params: string): string {
       // 实现提示词逻辑
       return prompt;
   }
   ```

### 修改现有提示词

1. 确保修改不会破坏现有功能
2. 更新相关的注释和文档
3. 测试所有使用该提示词的功能

### 最佳实践

1. **提示词设计**：
   - 明确、具体的指令
   - 包含必要的上下文信息
   - 指定期望的输出格式

2. **错误处理**：
   - 提供有意义的错误信息
   - 包含可能的解决方案
   - 避免技术术语，使用用户友好的语言

3. **性能考虑**：
   - 避免过长的提示词
   - 合理使用缓存机制
   - 考虑 API 调用成本

## 未来扩展

1. **多语言支持**：支持国际化的提示词模板
2. **动态配置**：支持运行时修改提示词模板
3. **A/B 测试**：支持不同提示词版本的效果对比
4. **智能优化**：基于使用效果自动优化提示词