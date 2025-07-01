package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// LLMService LLM服务结构体
type LLMService struct {
	client *arkruntime.Client
	config *LLMConfig
}

// LLMProcessResult LLM处理结果
type LLMProcessResult struct {
	SQL         string  `json:"sql"`
	BusinessID  string  `json:"business_id"`
	Definition  string  `json:"definition"`
	Description string  `json:"description"`
	Confidence  float64 `json:"confidence"`
}

// NewLLMService 创建新的LLM服务实例
func NewLLMService(config *LLMConfig) *LLMService {
	service := &LLMService{
		config: config,
	}
	service.initClient()
	return service
}

// initClient 初始化客户端
func (llm *LLMService) initClient() {
	if llm.config.APIKey != "" {
		llm.client = arkruntime.NewClientWithApiKey(
			llm.config.APIKey,
			arkruntime.WithBaseUrl(llm.config.BaseURL),
			arkruntime.WithTimeout(llm.config.GetTimeout()),
		)
	}
}

// SetAPIKey 设置API密钥
func (llm *LLMService) SetAPIKey(apiKey string) {
	llm.config.APIKey = apiKey
	llm.initClient()
}

// ProcessNaturalLanguage 处理自然语言输入
func (llm *LLMService) ProcessNaturalLanguage(input string, tableSchema string, availableTables []string) (*LLMProcessResult, error) {
	if input == "" {
		return nil, fmt.Errorf("输入不能为空")
	}

	if llm.client == nil {
		return nil, fmt.Errorf("请先配置火山引擎API密钥")
	}

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), llm.config.GetTimeout())
	defer cancel()

	return llm.callLLMAPI(ctx, input, tableSchema, availableTables)
}

// callLLMAPI 调用火山引擎LLM API
func (llm *LLMService) callLLMAPI(ctx context.Context, input, tableSchema string, availableTables []string) (*LLMProcessResult, error) {
	// 构建系统提示词
	systemPrompt := llm.buildSystemPrompt(tableSchema, strings.Join(availableTables, ", "))

	// 构建请求
	req := model.ChatCompletionRequest{
		Model: llm.config.ModelID,
		Messages: []*model.ChatCompletionMessage{
			{
				Role: model.ChatMessageRoleSystem,
				Content: &model.ChatCompletionMessageContent{
					StringValue: &systemPrompt,
				},
			},
			{
				Role: model.ChatMessageRoleUser,
				Content: &model.ChatCompletionMessageContent{
					StringValue: &input,
				},
			},
		},
	}

	// 发送请求
	response, err := llm.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("调用LLM API失败: %v", err)
	}

	// 解析响应
	return llm.parseResponse(&response, input)
}

// buildSystemPrompt 构建系统提示词
func (llm *LLMService) buildSystemPrompt(tableSchema, availableTables string) string {
	return fmt.Sprintf(`你是一个专业的SQL生成助手，专门将自然语言需求转换为SQL查询语句。

可用表格：%s

表结构信息：
%s

请根据用户的自然语言需求，生成对应的SQL查询语句。你的回复必须严格按照以下JSON格式：

{
  "business_id": "业务唯一标识符（英文，如sales_ranking_analysis）",
  "sql": "SELECT语句",
  "definition": "业务定义（中文，简洁描述）",
  "description": "详细说明（中文，解释查询目的和结果）",
  "confidence": 0.95
}

要求：
1. 只生成SELECT查询语句
2. 确保SQL语法正确
3. 使用提供的表名和字段名
4. confidence表示生成结果的置信度（0-1之间）
5. 严格按照JSON格式回复，不要添加其他内容`, availableTables, tableSchema)
}

// parseResponse 解析LLM响应
func (llm *LLMService) parseResponse(response *model.ChatCompletionResponse, originalInput string) (*LLMProcessResult, error) {
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("LLM返回空响应")
	}

	content := *response.Choices[0].Message.Content.StringValue

	// 提取JSON部分
	jsonStr := llm.extractJSON(content)
	if jsonStr == "" {
		return nil, fmt.Errorf("无法从响应中提取JSON: %s", content)
	}

	// 解析JSON
	var result struct {
		BusinessID  string  `json:"business_id"`
		SQL         string  `json:"sql"`
		Definition  string  `json:"definition"`
		Description string  `json:"description"`
		Confidence  float64 `json:"confidence"`
	}

	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("解析JSON失败: %v, 原始内容: %s", err, jsonStr)
	}

	// 验证必要字段
	if result.SQL == "" {
		return nil, fmt.Errorf("LLM未返回SQL语句")
	}

	// 基本SQL验证
	if err := llm.validateSQL(result.SQL); err != nil {
		return nil, fmt.Errorf("生成的SQL无效: %v", err)
	}

	return &LLMProcessResult{
		SQL:         result.SQL,
		BusinessID:  result.BusinessID,
		Definition:  result.Definition,
		Description: result.Description,
		Confidence:  result.Confidence,
	}, nil
}

// extractJSON 从文本中提取JSON部分
func (llm *LLMService) extractJSON(content string) string {
	startIdx := strings.Index(content, "{")
	if startIdx == -1 {
		return ""
	}

	endIdx := strings.LastIndex(content, "}")
	if endIdx == -1 || endIdx <= startIdx {
		return ""
	}

	return content[startIdx : endIdx+1]
}

// validateSQL 基本的SQL语法验证
func (llm *LLMService) validateSQL(sql string) error {
	sql = strings.TrimSpace(strings.ToUpper(sql))

	// 检查是否是查询语句
	if !strings.HasPrefix(sql, "SELECT") {
		return fmt.Errorf("只支持SELECT查询语句")
	}

	// 检查危险操作
	dangerousKeywords := []string{"DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE"}
	for _, keyword := range dangerousKeywords {
		if strings.Contains(sql, keyword) {
			return fmt.Errorf("SQL包含危险操作: %s", keyword)
		}
	}

	return nil
}