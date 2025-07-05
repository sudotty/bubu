package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// LLMService LLM服务结构体
type LLMService struct {
	client  *arkruntime.Client
	config  *LLMConfig
	prompts *PromptTemplates
}

// LLMProcessResult LLM处理结果
type LLMProcessResult struct {
	SQL         string   `json:"sql"`
	BusinessID  string   `json:"business_id"`
	Definition  string   `json:"definition"`
	Description string   `json:"description"`
	Confidence  float64  `json:"confidence"`
	Suggestions []string `json:"suggestions"`
	// 调试信息
	DebugInfo *DebugInfo `json:"debug_info,omitempty"`
}

// DebugInfo 调试信息结构
type DebugInfo struct {
	OriginalPrompt string      `json:"original_prompt,omitempty"`
	SystemPrompt   string      `json:"system_prompt,omitempty"`
	UserPrompt     string      `json:"user_prompt,omitempty"`
	LLMRawResponse interface{} `json:"llm_raw_response,omitempty"`
	ProcessingTime int64       `json:"processing_time,omitempty"`
	APIEndpoint    string      `json:"api_endpoint,omitempty"`
	ModelUsed      string      `json:"model_used,omitempty"`
}

// NewLLMService 创建新的LLM服务实例
func NewLLMService(config *LLMConfig) *LLMService {
	service := &LLMService{
		config:  config,
		prompts: NewPromptTemplates(),
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

	// 记录开始时间
	startTime := time.Now()

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), llm.config.GetTimeout())
	defer cancel()

	result, err := llm.callLLMAPI(ctx, input, tableSchema, availableTables)
	if err != nil {
		return nil, err
	}

	// 计算处理时间
	processingTime := time.Since(startTime).Milliseconds()

	// 构建调试信息
	systemPrompt := llm.prompts.BuildSQLGenerationPrompt(tableSchema, strings.Join(availableTables, ", "))
	originalPrompt := fmt.Sprintf("System: %s\n\nUser: %s", systemPrompt, input)

	result.DebugInfo = &DebugInfo{
		OriginalPrompt: originalPrompt,
		SystemPrompt:   systemPrompt,
		UserPrompt:     input,
		ProcessingTime: processingTime,
		APIEndpoint:    llm.config.BaseURL,
		ModelUsed:      llm.config.ModelID,
	}

	return result, nil
}

// callLLMAPI 调用火山引擎LLM API
func (llm *LLMService) callLLMAPI(ctx context.Context, input, tableSchema string, availableTables []string) (*LLMProcessResult, error) {
	// 构建系统提示词
	systemPrompt := llm.prompts.BuildSQLGenerationPrompt(tableSchema, strings.Join(availableTables, ", "))

	// 构建请求
	req := model.CreateChatCompletionRequest{
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
		Thinking: &model.Thinking{
			Type: model.ThinkingTypeDisabled, // 关闭深度思考能力
			// Type: model.ThinkingTypeEnabled, //开启深度思考能力
			// Type: model.ThinkingTypeAuto, //模型自行判断是否使用深度思考能力
		},
	}

	// 发送请求
	response, err := llm.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("调用LLM API失败: %v", err)
	}
	

	// 解析响应
	result, err := llm.parseResponse(&response, input)
	if err != nil {
		return nil, err
	}

	// 保存原始响应到结果中
	if result.DebugInfo == nil {
		result.DebugInfo = &DebugInfo{}
	}
	result.DebugInfo.LLMRawResponse = response

	return result, nil
}

// buildSystemPrompt 构建系统提示词 (已废弃，使用PromptTemplates代替)
// 保留此方法以确保向后兼容性
func (llm *LLMService) buildSystemPrompt(tableSchema, availableTables string) string {
	return llm.prompts.BuildSQLGenerationPrompt(tableSchema, availableTables)
}

// parseResponse 解析LLM响应
func (llm *LLMService) parseResponse(response *model.ChatCompletionResponse, originalInput string) (*LLMProcessResult, error) {
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("LLM返回空响应")
	}

	content := *response.Choices[0].Message.Content.StringValue
 // 检查是否触发深度思考，触发则打印思维链内容
    // if response.Choices[0].Message.ReasoningContent != nil {
    //     thinkChain = *response.Choices[0].Message.ReasoningContent
    // }
	// 提取JSON部分
	jsonStr := llm.extractJSON(content)
	if jsonStr == "" {
		return nil, fmt.Errorf("无法从响应中提取JSON: %s", content)
	}

	// 解析JSON
	var result struct {
		BusinessID  string   `json:"business_id"`
		SQL         string   `json:"sql"`
		Definition  string   `json:"definition"`
		Description string   `json:"description"`
		Confidence  float64  `json:"confidence"`
		Suggestions []string `json:"suggestions"`
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
		Suggestions: result.Suggestions,
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

// validateSQL 验证SQL语句的安全性
func (llm *LLMService) validateSQL(sql string) error {
	// 转换为小写进行检查
	sqlLower := strings.ToLower(strings.TrimSpace(sql))

	// 只允许SELECT语句
	if !strings.HasPrefix(sqlLower, "select") {
		return fmt.Errorf("只支持SELECT查询语句")
	}

	// 检查危险关键词
	dangerousKeywords := []string{"drop", "delete", "update", "insert", "alter", "create", "truncate"}
	for _, keyword := range dangerousKeywords {
		if strings.Contains(sqlLower, keyword) {
			return fmt.Errorf("SQL包含危险操作: %s", keyword)
		}
	}

	return nil
}
