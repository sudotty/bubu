# 配置文件使用指南

## 📋 概述

本项目现在使用 `config.yaml` 文件来管理所有配置，包括火山引擎LLM配置、数据库设置、文件上传限制等。

## 🔧 配置文件结构

### 完整配置示例

```yaml
# LLM服务配置
llm:
  # 火山引擎API密钥
  api_key: "your-volcengine-api-key-here"
  # API基础URL
  base_url: "https://ark.cn-beijing.volces.com/api/v3"
  # 模型ID
  model_id: "doubao-seed-1.6-flash-250615"
  # 请求超时时间（秒）
  timeout_seconds: 60
  # 最大重试次数
  max_retries: 3
  # 重试延迟时间（秒）
  retry_delay_seconds: 1
  # 生成温度参数 (0.0-2.0)
  temperature: 0.7
  # 最大生成令牌数
  max_tokens: 4096
  # Top-p 采样参数 (0.0-1.0)
  top_p: 0.9
  # 频率惩罚参数
  frequency_penalty: 0.0
  # 存在惩罚参数
  presence_penalty: 0.0
  # 系统提示词配置
  system_prompt:
    enable_custom: false
    custom_prompt: ""
  # 内容过滤
  enable_content_filter: true
  # 最大并发请求数
  max_concurrent_requests: 1

# 数据库配置
database:
  # 数据库文件路径
  path: "bubu.db"
  # 最大连接数
  max_connections: 10
  # 连接超时时间（秒）
  connection_timeout_seconds: 30

# 文件上传配置
file_upload:
  # 上传目录
  upload_dir: "uploads"
  # 最大文件大小（MB）
  max_file_size_mb: 100
  # 允许的文件扩展名
  allowed_extensions:
    - ".csv"
    - ".xlsx"
    - ".xls"

# 应用配置
app:
  # 应用名称
  name: "Bubu BI"
  # 版本号
  version: "1.0.0"
  # 调试模式
  debug: false
  # 日志级别
  log_level: "info"

# 导出配置
export:
  # 默认导出格式
  default_format: "xlsx"
  # 最大导出行数
  max_rows: 100000
  # 是否包含时间戳
  include_timestamp: true
```

## 🚀 支持的火山引擎模型

根据火山引擎官方文档，支持以下模型：

### 主要模型
- `doubao-seed-1.6-flash-250615` - 默认模型，平衡性能和质量
- `doubao-seed-1.6-flash-250615` - 快速响应模型

### 模型特点
- **seed系列**: 适合一般对话和文本生成
- **flash系列**: 响应速度更快，适合实时应用

## 📝 使用方法

### 1. 首次运行

应用首次运行时会自动创建默认配置文件 `config.yaml`，你需要：

1. 设置你的火山引擎API密钥
2. 根据需要调整其他配置参数

### 2. 通过代码修改配置

```go
// 设置API密钥
app.SetLLMAPIKey("your-new-api-key")

// 切换到快速模型
app.SetLLMModel("doubao-seed-1.6-flash-250615")

// 设置超时时间为30秒
app.SetLLMTimeout(30)

// 重新加载配置文件
app.ReloadConfig()
```

### 3. 直接编辑配置文件

你也可以直接编辑 `config.yaml` 文件，然后调用 `app.ReloadConfig()` 重新加载。

## 🔒 安全注意事项

1. **API密钥保护**: 请妥善保管配置文件中的API密钥，不要提交到版本控制系统
2. **文件权限**: 建议设置配置文件的访问权限为 `600` (仅所有者可读写)
3. **环境隔离**: 不同环境（开发、测试、生产）使用不同的配置文件

## 🛠️ 配置验证

系统会自动验证配置的有效性：

- API密钥不能为空
- 超时时间必须大于0
- 温度参数必须在0-2之间
- TopP参数必须在0-1之间
- 文件大小限制必须大于0

## 📊 配置监控

你可以通过以下方式监控当前配置：

```go
// 获取完整LLM配置信息
config := app.GetLLMConfig()
fmt.Printf("当前模型: %s\n", config["model"])
fmt.Printf("超时时间: %d秒\n", config["timeout_seconds"])
fmt.Printf("API密钥状态: %v\n", config["api_key_set"])
```

## 🔄 配置热重载

支持在运行时重新加载配置，无需重启应用：

```go
// 重新加载配置
err := app.ReloadConfig()
if err != nil {
    log.Printf("重新加载配置失败: %v", err)
}
```

## 📚 参考文档

- [火山引擎大模型API文档](https://www.volcengine.com/docs/82379/1568221)
- [模型列表和参数说明](https://www.volcengine.com/docs/82379/1221660)
- [API调用示例](https://www.volcengine.com/docs/82379/1359497)