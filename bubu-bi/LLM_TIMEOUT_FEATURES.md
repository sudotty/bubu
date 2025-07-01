# LLM超时和中断功能说明

## 功能概述

本次更新为AI思考和分析过程添加了超时功能和人工手动中断功能，解决了之前可以无限等待的问题。

## 新增功能

### 1. 超时功能

- **默认超时时间**: 60秒
- **可配置范围**: 1-300秒
- **超时处理**: 当请求超过设定时间时，自动取消并返回超时错误

#### 使用方法

```javascript
// 前端调用示例

// 设置超时时间为120秒
await window.go.main.App.SetLLMTimeout(120);

// 获取当前超时时间
const timeout = await window.go.main.App.GetLLMTimeout();
console.log(`当前超时时间: ${timeout}秒`);
```

### 2. 手动中断功能

- **实时状态检查**: 可以检查当前是否有请求正在处理
- **手动取消**: 用户可以主动取消正在进行的请求
- **并发控制**: 同时只允许一个请求处理，避免资源冲突

#### 使用方法

```javascript
// 前端调用示例

// 检查是否正在处理
const isProcessing = await window.go.main.App.IsLLMProcessing();
if (isProcessing) {
    console.log('AI正在思考中...');
}

// 取消当前处理
try {
    await window.go.main.App.CancelLLMProcessing();
    console.log('已成功取消AI处理');
} catch (error) {
    console.log('取消失败:', error);
}
```

### 3. 配置信息查看

可以查看当前LLM的完整配置信息，包括模型、API提供商、超时设置等。

```javascript
// 获取LLM配置信息
const config = await window.go.main.App.GetLLMConfig();
console.log('LLM配置:', config);

// 输出示例:
// {
//   "model_id": "doubao-seed-1.6-flash-250615",
//   "api_provider": "火山引擎",
//   "api_endpoint": "https://ark.cn-beijing.volces.com/api/v3",
//   "timeout_seconds": 60,
//   "is_processing": false,
//   "api_key_status": "已配置（硬编码）"
// }
```

## 🔧 火山引擎配置信息

### 配置文件系统
现在所有配置都通过 `config.yaml` 文件管理，包括：

#### LLM配置
- **API密钥**: 可在配置文件中设置
- **大模型**: 支持多种模型，默认 `doubao-seed-1.6-flash-250615`
- **API端点**: `https://ark.cn-beijing.volces.com/api/v3`
- **超时设置**: 可配置，默认60秒
- **重试机制**: 可配置重试次数和延迟
- **生成参数**: 温度、最大令牌数、TopP等

#### 支持的模型
- `doubao-seed-1.6-flash-250615` (默认)
- `doubao-seed-1.6-flash-250615`
- 其他火山引擎支持的模型

#### 配置文件位置
- 默认路径: 可执行文件同目录下的 `config.yaml`
- 首次运行时自动创建默认配置文件

## 技术实现细节

### 1. 并发安全

使用 `sync.RWMutex` 确保多线程环境下的状态管理安全：

```go
type LLMService struct {
    client        *arkruntime.Client
    modelID       string
    timeout       time.Duration
    cancelFunc    context.CancelFunc
    processingMux sync.RWMutex
    isProcessing  bool
}
```

### 2. 上下文管理

使用 `context.WithTimeout` 实现超时控制：

```go
// 创建带超时的上下文
ctx, cancel := context.WithTimeout(context.Background(), llm.timeout)
llm.cancelFunc = cancel
defer cancel()
```

### 3. 重试机制优化

在重试过程中也会检查超时和取消状态，确保及时响应用户操作。

## 错误处理

### 超时错误
```
请求超时（60s），请尝试减少查询复杂度或增加超时时间
```

### 取消错误
```
请求被取消
```

### 并发错误
```
已有请求正在处理中，请等待完成或取消当前请求
```

## 💡 使用示例

### 配置管理
```go
// 设置API密钥
app.SetLLMAPIKey("your-api-key")

// 切换模型
app.SetLLMModel("doubao-seed-1.6-flash-250615")

// 设置超时时间为30秒
app.SetLLMTimeout(30)

// 重新加载配置
app.ReloadConfig()
```

### 状态监控
```go
// 检查处理状态
if app.IsLLMProcessing() {
    fmt.Println("LLM正在处理请求...")
}

// 手动取消处理
app.CancelLLMProcessing()

// 查看完整配置
config := app.GetLLMConfig()
fmt.Printf("当前模型: %s\n", config["model"])
fmt.Printf("超时时间: %d秒\n", config["timeout_seconds"])
fmt.Printf("API密钥已设置: %v\n", config["api_key_set"])
```

### 配置文件示例
```yaml
llm:
  api_key: "your-api-key-here"
  base_url: "https://ark.cn-beijing.volces.com/api/v3"
  model_id: "doubao-seed-1.6-flash-250615"
  timeout_seconds: 60
  max_retries: 3
  temperature: 0.7
  max_tokens: 4096
  top_p: 0.9
```

## 📁 修改的文件

1. **config.yaml** - 新增配置文件
2. **config.go** - 新增配置管理模块
3. **llm_service.go** - 重构为使用配置文件
4. **app.go** - 更新为使用配置系统
5. **go.mod** - 添加yaml.v3依赖
6. **llm_timeout_test.go** - 更新测试以适应新配置
7. **LLM_TIMEOUT_FEATURES.md** - 更新功能说明文档

## 使用建议

1. **合理设置超时时间**: 根据查询复杂度调整，简单查询可设置较短时间
2. **及时取消无用请求**: 避免资源浪费
3. **监控处理状态**: 在UI中显示处理状态，提升用户体验
4. **错误处理**: 妥善处理超时和取消错误，给用户友好提示
5. **配置管理**: 使用配置文件管理API密钥等敏感信息，避免硬编码

## 测试

运行测试文件验证功能：

```bash
go test -v llm_timeout_test.go llm_service.go models.go
```

## 注意事项

1. **配置文件安全**: 请妥善保管 `config.yaml` 文件中的API密钥
2. **超时时间**: 限制在1-300秒之间，可根据需要调整
3. **取消功能**: 只对正在进行的请求有效
4. **配置热重载**: 修改配置文件后需要调用 `ReloadConfig()` 或重启应用
5. **火山引擎API**: 具体限制请参考官方文档