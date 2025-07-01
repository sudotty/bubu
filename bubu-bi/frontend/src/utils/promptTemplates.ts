/**
 * 前端提示词模板管理
 * 统一管理所有前端相关的提示词和文本模板
 */

export class PromptTemplates {
  /**
   * 构建数据库结构展示提示词
   * 业务意义：为用户展示当前可用的数据表和字段信息
   * 应用场景：Prompt模态框、调试信息展示、用户帮助
   * @param tables 表名列表
   * @param schemas 表结构信息映射
   * @returns 格式化的数据库结构描述
   */
  static buildDatabaseSchemaPrompt(tables: string[], schemas: Record<string, any>): string {
    let prompt = '可用的数据表和字段信息:\n';
    
    tables.forEach(table => {
      prompt += `\n表名: ${table}\n`;
      const schema = schemas[table];
      if (schema && schema.columns) {
        prompt += `字段: ${schema.columns.join(', ')}\n`;
        
        // 如果有字段类型信息，也显示出来
        if (schema.columnTypes) {
          prompt += `字段类型: ${schema.columnTypes.map((type: string, index: number) => 
            `${schema.columns[index]}(${type})`
          ).join(', ')}\n`;
        }
        
        // 如果有主键信息
        if (schema.primaryKeys && schema.primaryKeys.length > 0) {
          prompt += `主键: ${schema.primaryKeys.join(', ')}\n`;
        }
        
        // 如果有外键信息
        if (schema.foreignKeys && schema.foreignKeys.length > 0) {
          prompt += `外键: ${schema.foreignKeys.map((fk: any) => 
            `${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`
          ).join(', ')}\n`;
        }
      }
    });
    
    return prompt;
  }

  /**
   * 构建用户查询上下文提示词
   * 业务意义：为LLM提供用户查询的完整上下文信息
   * 应用场景：调试信息记录、LLM上下文构建
   * @param query 用户查询内容
   * @param historyCount 历史消息数量
   * @returns 格式化的查询上下文
   */
  static buildQueryContextPrompt(query: string, historyCount: number): string {
    return `用户查询: ${query}\n\n上下文: ${historyCount > 0 ? '包含' + historyCount + '条历史消息' : '无历史消息'}`;
  }

  /**
   * 构建错误提示信息
   * 业务意义：为用户提供友好的错误信息和解决建议
   * 应用场景：错误处理、用户引导
   * @param errorType 错误类型
   * @param context 错误上下文
   * @returns 用户友好的错误信息
   */
  static buildErrorMessage(errorType: 'network' | 'parsing' | 'sql' | 'timeout' | 'unknown', context?: string): string {
    const errorMessages = {
      network: '网络连接异常，请检查网络设置后重试',
      parsing: '数据解析失败，请尝试重新描述您的查询需求',
      sql: 'SQL执行出错，请检查查询条件或联系管理员',
      timeout: '查询超时，请尝试简化查询条件或稍后重试',
      unknown: '系统遇到未知错误，请稍后重试或联系技术支持'
    };
    
    let message = errorMessages[errorType];
    if (context) {
      message += `\n\n详细信息: ${context}`;
    }
    
    return message;
  }

  /**
   * 构建加载状态提示信息
   * 业务意义：为用户提供清晰的系统状态反馈
   * 应用场景：数据加载、处理进度展示
   * @param stage 当前处理阶段
   * @returns 对应的加载提示信息
   */
  static buildLoadingMessage(stage: 'analyzing' | 'querying' | 'processing' | 'generating'): string {
    const loadingMessages = {
      analyzing: '正在分析您的查询需求...',
      querying: '正在执行数据查询...',
      processing: '正在处理查询结果...',
      generating: '正在生成分析报告...'
    };
    
    return loadingMessages[stage];
  }

  /**
   * 构建数据洞察提示模板
   * 业务意义：指导用户理解数据分析结果
   * 应用场景：结果展示、用户教育
   * @param dataType 数据类型
   * @param recordCount 记录数量
   * @returns 数据洞察提示
   */
  static buildDataInsightPrompt(dataType: 'table' | 'chart' | 'summary', recordCount: number): string {
    const basePrompt = `本次查询返回了 ${recordCount} 条记录`;
    
    const typeSpecificPrompts = {
      table: '，您可以查看详细的数据表格，或尝试不同的筛选条件',
      chart: '，建议查看可视化图表以获得更直观的数据洞察',
      summary: '，以下是数据的统计摘要和关键指标'
    };
    
    return basePrompt + typeSpecificPrompts[dataType];
  }

  /**
   * 构建操作建议提示
   * 业务意义：引导用户进行下一步操作
   * 应用场景：用户引导、功能发现
   * @param context 当前操作上下文
   * @returns 操作建议列表
   */
  static buildActionSuggestions(context: 'empty_result' | 'large_result' | 'error_result' | 'success_result'): string[] {
    const suggestions = {
      empty_result: [
        '尝试调整查询条件或时间范围',
        '检查表名和字段名是否正确',
        '使用更宽泛的筛选条件'
      ],
      large_result: [
        '添加更多筛选条件以缩小结果范围',
        '使用分页查看数据',
        '考虑使用聚合查询获取摘要信息'
      ],
      error_result: [
        '检查查询语法是否正确',
        '确认表名和字段名拼写',
        '简化查询条件后重试'
      ],
      success_result: [
        '尝试不同的数据可视化方式',
        '深入分析特定数据子集',
        '导出数据进行进一步分析'
      ]
    };
    
    return suggestions[context];
  }

  /**
   * 构建调试信息模板
   * 业务意义：为开发者提供详细的调试信息
   * 应用场景：问题排查、性能优化
   * @param debugData 调试数据
   * @returns 格式化的调试信息
   */
  static buildDebugInfo(debugData: {
    originalPrompt?: string;
    llmRawResponse?: any;
    processingTime?: number;
    apiEndpoint?: string;
    modelUsed?: string;
  }): string {
    let debugInfo = '=== 调试信息 ===\n';
    
    if (debugData.originalPrompt) {
      debugInfo += `原始Prompt:\n${debugData.originalPrompt}\n\n`;
    }
    
    if (debugData.processingTime) {
      debugInfo += `处理时间: ${debugData.processingTime}ms\n`;
    }
    
    if (debugData.apiEndpoint) {
      debugInfo += `API端点: ${debugData.apiEndpoint}\n`;
    }
    
    if (debugData.modelUsed) {
      debugInfo += `使用模型: ${debugData.modelUsed}\n`;
    }
    
    if (debugData.llmRawResponse) {
      debugInfo += `\nLLM原始响应:\n${JSON.stringify(debugData.llmRawResponse, null, 2)}`;
    }
    
    return debugInfo;
  }

  /**
   * 构建帮助文档提示
   * 业务意义：为用户提供使用指导
   * 应用场景：用户帮助、功能介绍
   * @param section 帮助章节
   * @returns 帮助内容
   */
  static buildHelpContent(section: 'query_tips' | 'chart_types' | 'data_export' | 'troubleshooting'): string {
    const helpContent = {
      query_tips: `查询技巧：\n• 使用自然语言描述您的数据需求\n• 指定具体的时间范围和筛选条件\n• 可以询问趋势、对比、排名等分析问题\n• 支持多表关联查询`,
      chart_types: `图表类型：\n• 柱状图：适合类别对比\n• 折线图：适合趋势分析\n• 饼图：适合占比展示\n• 散点图：适合相关性分析`,
      data_export: `数据导出：\n• 支持CSV格式导出\n• 支持Excel格式导出\n• 可导出原始数据或图表\n• 支持自定义导出范围`,
      troubleshooting: `故障排除：\n• 查询无结果：检查筛选条件\n• 查询出错：简化查询语句\n• 加载缓慢：减少数据量\n• 图表异常：检查数据格式`
    };
    
    return helpContent[section];
  }
}

// 错误提示信息
export const ERROR_MESSAGES = {
  QUERY_FAILED: '查询失败，请重试',
  PROCESSING_ERROR: '抱歉，处理您的查询时遇到了问题。请重新尝试或换个方式描述您的需求。',
  NETWORK_ERROR: '网络连接异常，请检查网络设置',
  DATA_ERROR: '数据格式错误，请检查输入',
  UNKNOWN_ERROR: '发生未知错误，请联系技术支持'
};

// 导出常用的提示词常量
export const COMMON_PROMPTS = {
  // 默认建议（当LLM没有返回建议时使用）
  DEFAULT_SUGGESTIONS: [
    '尝试描述您想要查看的具体数据',
    '指定时间范围或筛选条件',
    '询问数据的趋势或对比分析'
  ],
  
  // 错误恢复建议
  ERROR_RECOVERY_SUGGESTIONS: [
    '检查网络连接',
    '尝试简化查询内容',
    '稍后重试'
  ],
  
  // 空结果提示
  EMPTY_RESULT_MESSAGE: '未找到符合条件的数据，请尝试调整查询条件',
  
  // 成功查询提示
  SUCCESS_QUERY_MESSAGE: '查询完成，以下是分析结果'
};