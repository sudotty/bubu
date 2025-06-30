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

// LLMService 火山引擎LLM服务
type LLMService struct {
	client  *arkruntime.Client
	modelID string
}



// LLMProcessResult LLM处理结果
type LLMProcessResult struct {
	BusinessID  string `json:"business_id"`
	SQL         string `json:"sql"`
	Definition  string `json:"definition"`
	Description string `json:"description"`
	Confidence  float64 `json:"confidence"`
	RawResponse string `json:"raw_response"`
	RetryCount  int    `json:"retry_count"`
	ProcessTime int64  `json:"process_time_ms"`
}

// ComponentInfo 组件信息
type ComponentInfo struct {
	ID          string    `json:"id"`
	BusinessID  string    `json:"business_id"`
	SQL         string    `json:"sql"`
	Definition  string    `json:"definition"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `json:"created_at"`
	UsageCount  int       `json:"usage_count"`
}

// NewLLMService 创建新的LLM服务
func NewLLMService() *LLMService {
	return &LLMService{
		client:  nil, // 初始化时不创建客户端，等待用户输入API密钥
		modelID: "doubao-seed-1.6-250615", // 默认模型
	}
}

// SetAPIKey 设置API密钥
func (llm *LLMService) SetAPIKey(apiKey string) {
	// 重新创建客户端
	llm.client = arkruntime.NewClientWithApiKey(
		apiKey,
		arkruntime.WithBaseUrl("https://ark.cn-beijing.volces.com/api/v3"),
		arkruntime.WithTimeout(30*time.Second),
	)
}

// ProcessNaturalLanguage 处理自然语言输入
func (llm *LLMService) ProcessNaturalLanguage(input string, tableSchema string, availableTables []string) (*LLMProcessResult, error) {
	if input == "" {
		return nil, fmt.Errorf("输入不能为空")
	}

	if llm.client == nil {
		return nil, fmt.Errorf("请先配置火山引擎API密钥")
	}

	startTime := time.Now()
	var result *LLMProcessResult
	var err error

	// 重试机制
	for retry := 0; retry <= 3; retry++ {
		result, err = llm.callLLMAPI(input, tableSchema, availableTables)
		if err == nil && result != nil {
			result.RetryCount = retry
			result.ProcessTime = time.Since(startTime).Milliseconds()
			return result, nil
		}
		
		if retry < 3 {
			time.Sleep(time.Duration(retry+1) * time.Second) // 递增延迟
		}
	}

	return nil, fmt.Errorf("LLM处理失败，重试3次后仍然失败: %v", err)
}

// callLLMAPI 调用火山引擎LLM API
func (llm *LLMService) callLLMAPI(input, tableSchema string, availableTables []string) (*LLMProcessResult, error) {
	// 构建系统提示词
	systemPrompt := llm.buildSystemPrompt(tableSchema, strings.Join(availableTables, ", "))

	// 创建上下文
	ctx := context.Background()

	// 构建请求
	req := model.ChatCompletionRequest{
		Model: llm.modelID,
		Messages: []*model.ChatCompletionMessage{
			{
			Role:    model.ChatMessageRoleSystem,
			Content: &model.ChatCompletionMessageContent{
				StringValue: &systemPrompt,
			},
		},
		{
			Role:    model.ChatMessageRoleUser,
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
	tablesInfo := availableTables
	
	return fmt.Sprintf(`你是一个专业的SQL生成助手，专门将自然语言需求转换为SQL查询语句。

可用表格：%s

表结构信息：
%s

请根据用户的自然语言需求，生成对应的SQL查询语句。你的回复必须严格按照以下JSON格式：

{
  "business_id": "业务唯一标识符（英文，如sales_ranking_analysis）",
  "sql": "生成的SQL查询语句",
  "definition": "业务定义（简洁描述这个查询的业务含义）",
  "description": "详细说明（解释SQL的逻辑和预期结果）",
  "confidence": 0.95
}

注意事项：
1. SQL语句必须是有效的SQLite语法
2. 表名使用反引号包围，如 ` + "`table_name`" + `
3. 字段名要准确匹配表结构
4. business_id要具有业务含义且唯一
5. confidence值在0-1之间，表示生成SQL的置信度
6. 只返回JSON格式，不要包含其他文字说明`, tablesInfo, tableSchema)
}



// parseResponse 解析LLM响应
func (llm *LLMService) parseResponse(response *model.ChatCompletionResponse, originalInput string) (*LLMProcessResult, error) {
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("LLM响应为空")
	}

	// 获取响应内容
	content := *response.Choices[0].Message.Content.StringValue
	if content == "" {
		return nil, fmt.Errorf("LLM响应内容为空")
	}

	// 提取JSON部分
	jsonStr := llm.extractJSON(content)
	if jsonStr == "" {
		return nil, fmt.Errorf("无法从响应中提取JSON")
	}

	// 解析JSON
	var result map[string]interface{}
	err := json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
		return nil, fmt.Errorf("解析JSON失败: %v", err)
	}

	// 提取字段
	sql, _ := result["sql"].(string)
	businessID, _ := result["business_id"].(string)
	definition, _ := result["definition"].(string)
	description, _ := result["description"].(string)
	confidence, _ := result["confidence"].(float64)

	// 验证SQL
	if err := llm.validateSQL(sql); err != nil {
		return nil, fmt.Errorf("生成的SQL无效: %v", err)
	}

	return &LLMProcessResult{
		SQL:         sql,
		BusinessID:  businessID,
		Definition:  definition,
		Description: description,
		Confidence:  confidence,
		RawResponse: content,
		ProcessTime: 0, // 这里可以添加实际的处理时间
		RetryCount:  0,
	}, nil
}

// extractJSON 从文本中提取JSON部分
func (llm *LLMService) extractJSON(content string) string {
	// 查找JSON开始和结束位置
	startIdx := strings.Index(content, "{")
	if startIdx == -1 {
		return ""
	}

	// 从后往前查找最后一个}
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

// GetRecommendedComponents 获取推荐组件
func (llm *LLMService) GetRecommendedComponents(input string, components []ComponentInfo) []ComponentInfo {
	var recommended []ComponentInfo
	inputLower := strings.ToLower(input)

	// 简单的关键词匹配推荐
	for _, component := range components {
		score := 0
		
		// 检查业务ID匹配
		if strings.Contains(inputLower, strings.ToLower(component.BusinessID)) {
			score += 10
		}
		
		// 检查定义匹配
		if strings.Contains(inputLower, strings.ToLower(component.Definition)) {
			score += 5
		}
		
		// 检查描述匹配
		if strings.Contains(inputLower, strings.ToLower(component.Description)) {
			score += 3
		}
		
		if score > 0 {
			recommended = append(recommended, component)
		}
	}

	// 按使用次数排序
	for i := 0; i < len(recommended)-1; i++ {
		for j := i + 1; j < len(recommended); j++ {
			if recommended[i].UsageCount < recommended[j].UsageCount {
				recommended[i], recommended[j] = recommended[j], recommended[i]
			}
		}
	}

	// 限制返回数量
	if len(recommended) > 5 {
		recommended = recommended[:5]
	}

	return recommended
}