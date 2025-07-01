package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 应用配置结构体
type Config struct {
	App         AppConfig         `yaml:"app"`
	LLM         LLMConfig         `yaml:"llm"`
	Storage     StorageConfig     `yaml:"storage"`
	FileHandling FileHandlingConfig `yaml:"file_handling"`
	Export      ExportConfig      `yaml:"export"`
	System      SystemConfig      `yaml:"system"`
}

// AppConfig 应用配置
type AppConfig struct {
	Name     string `yaml:"name"`
	Version  string `yaml:"version"`
	Debug    bool   `yaml:"debug"`
	LogLevel string `yaml:"log_level"`
}

// LLMConfig LLM服务配置
type LLMConfig struct {
	APIKey         string `yaml:"api_key"`
	BaseURL        string `yaml:"base_url"`
	ModelID        string `yaml:"model_id"`
	TimeoutSeconds int    `yaml:"timeout_seconds"`
}

// StorageConfig 数据存储配置
type StorageConfig struct {
	Database DatabaseConfig `yaml:"database"`
	Paths    PathsConfig    `yaml:"paths"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Path                     string `yaml:"path"`
	MaxConnections           int    `yaml:"max_connections"`
	ConnectionTimeoutSeconds int    `yaml:"connection_timeout_seconds"`
}

// PathsConfig 路径配置
type PathsConfig struct {
	UploadsDir   string `yaml:"uploads_dir"`
	DownloadsDir string `yaml:"downloads_dir"`
	DatabaseFile string `yaml:"database_file"`
}

// FileHandlingConfig 文件处理配置
type FileHandlingConfig struct {
	Upload     UploadConfig     `yaml:"upload"`
	Processing ProcessingConfig `yaml:"processing"`
}

// UploadConfig 文件上传配置
type UploadConfig struct {
	UploadDir         string   `yaml:"upload_dir"`
	MaxFileSizeMB     int      `yaml:"max_file_size_mb"`
	AllowedExtensions []string `yaml:"allowed_extensions"`
}

// ProcessingConfig 文件处理配置
type ProcessingConfig struct {
	SupportedExtensions []string `yaml:"supported_extensions"`
	ConfidenceThreshold float64  `yaml:"confidence_threshold"`
}

// ExportConfig 导出配置
type ExportConfig struct {
	DefaultFormat    string `yaml:"default_format"`
	MaxRows          int    `yaml:"max_rows"`
	IncludeTimestamp bool   `yaml:"include_timestamp"`
	FilenameTemplate string `yaml:"filename_template"`
	TimestampFormat  string `yaml:"timestamp_format"`
}

// SystemConfig 系统配置
type SystemConfig struct {
	FilePermissions   int `yaml:"file_permissions"`
	ConfigPermissions int `yaml:"config_permissions"`
}

// 全局配置实例
var GlobalConfig *Config

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*Config, error) {
	// 如果没有指定配置文件路径，使用默认路径
	if configPath == "" {
		executableDir, err := os.Executable()
		if err != nil {
			return nil, fmt.Errorf("获取可执行文件路径失败: %v", err)
		}
		configPath = filepath.Join(filepath.Dir(executableDir), "config.yaml")
	}

	// 检查配置文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// 如果配置文件不存在，创建默认配置
		return createDefaultConfig(configPath)
	}

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %v", err)
	}

	// 解析YAML
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %v", err)
	}

	// 验证配置
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("配置验证失败: %v", err)
	}

	return &config, nil
}

// createDefaultConfig 创建默认配置文件
func createDefaultConfig(configPath string) (*Config, error) {
	config := &Config{
		App: AppConfig{
			Name:     getEnvOrDefault("BUBU_APP_NAME", AppName),
			Version:  getEnvOrDefault("BUBU_APP_VERSION", AppVersion),
			Debug:    getEnvBoolOrDefault("BUBU_APP_DEBUG", false),
			LogLevel: getEnvOrDefault("BUBU_APP_LOG_LEVEL", LogLevelInfo),
		},
		LLM: LLMConfig{
			APIKey:         getEnvOrDefault("BUBU_LLM_API_KEY", "your-api-key-here"),
			BaseURL:        getEnvOrDefault("BUBU_LLM_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
			ModelID:        getEnvOrDefault("BUBU_LLM_MODEL_ID", "doubao-seed-1.6-flash-250615"),
			TimeoutSeconds: getEnvIntOrDefault("BUBU_LLM_TIMEOUT_SECONDS", 60),
		},
		Storage: StorageConfig{
			Database: DatabaseConfig{
				Path:                     getEnvOrDefault("BUBU_DATABASE_PATH", "bubu.db"),
				MaxConnections:           getEnvIntOrDefault("BUBU_DATABASE_MAX_CONNECTIONS", 10),
				ConnectionTimeoutSeconds: getEnvIntOrDefault("BUBU_DATABASE_CONNECTION_TIMEOUT_SECONDS", 30),
			},
			Paths: PathsConfig{
				UploadsDir:   getEnvOrDefault("BUBU_PATH_UPLOADS_DIR", "uploads"),
				DownloadsDir: getEnvOrDefault("BUBU_PATH_DOWNLOADS_DIR", "downloads"),
				DatabaseFile: getEnvOrDefault("BUBU_PATH_DATABASE_FILE", "bubu.db"),
			},
		},
		FileHandling: FileHandlingConfig{
			Upload: UploadConfig{
				UploadDir:         getEnvOrDefault("BUBU_FILE_UPLOAD_DIR", "uploads"),
				MaxFileSizeMB:     getEnvIntOrDefault("BUBU_FILE_MAX_SIZE_MB", 100),
				AllowedExtensions: getEnvSliceOrDefault("BUBU_FILE_ALLOWED_EXTENSIONS", SupportedFileExtensions),
			},
			Processing: ProcessingConfig{
				SupportedExtensions: getEnvSliceOrDefault("BUBU_FILE_SUPPORTED_EXTENSIONS", SupportedFileExtensions),
				ConfidenceThreshold: getEnvFloatOrDefault("BUBU_FILE_CONFIDENCE_THRESHOLD", 0.95),
			},
		},
		Export: ExportConfig{
			DefaultFormat:    getEnvOrDefault("BUBU_EXPORT_DEFAULT_FORMAT", ExportFormatXLSX),
			MaxRows:          getEnvIntOrDefault("BUBU_EXPORT_MAX_ROWS", 100000),
			IncludeTimestamp: getEnvBoolOrDefault("BUBU_EXPORT_INCLUDE_TIMESTAMP", true),
			FilenameTemplate: getEnvOrDefault("BUBU_EXPORT_FILENAME_TEMPLATE", "查询结果_%s.xlsx"),
			TimestampFormat:  getEnvOrDefault("BUBU_EXPORT_TIMESTAMP_FORMAT", "20060102_150405"),
		},
		System: SystemConfig{
			FilePermissions:   getEnvIntOrDefault("BUBU_UI_FILE_PERMISSIONS", 0755),
			ConfigPermissions: getEnvIntOrDefault("BUBU_UI_CONFIG_PERMISSIONS", 0644),
		},
	}

	// 创建配置文件目录
	if err := os.MkdirAll(filepath.Dir(configPath), os.FileMode(config.System.FilePermissions)); err != nil {
		return nil, fmt.Errorf("创建配置文件目录失败: %v", err)
	}

	// 序列化为YAML
	data, err := yaml.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("序列化配置失败: %v", err)
	}

	// 写入配置文件
	if err := os.WriteFile(configPath, data, os.FileMode(config.System.ConfigPermissions)); err != nil {
		return nil, fmt.Errorf("写入配置文件失败: %v", err)
	}

	return config, nil
}

// validateConfig 验证配置
func validateConfig(config *Config) error {
	// 验证LLM配置
	if config.LLM.APIKey == "" {
		return fmt.Errorf("LLM API密钥不能为空")
	}
	if config.LLM.BaseURL == "" {
		return fmt.Errorf("LLM API基础URL不能为空")
	}
	if config.LLM.ModelID == "" {
		return fmt.Errorf("LLM模型ID不能为空")
	}
	if config.LLM.TimeoutSeconds <= 0 {
		return fmt.Errorf("LLM超时时间必须大于0")
	}

	// 验证数据库配置
	if config.Storage.Database.Path == "" {
		return fmt.Errorf("数据库路径不能为空")
	}

	// 验证文件上传配置
	if config.FileHandling.Upload.UploadDir == "" {
		return fmt.Errorf("上传目录不能为空")
	}
	if config.FileHandling.Upload.MaxFileSizeMB <= 0 {
		return fmt.Errorf("最大文件大小必须大于0")
	}

	return nil
}

// GetTimeout 获取超时时间
func (c *LLMConfig) GetTimeout() time.Duration {
	return time.Duration(c.TimeoutSeconds) * time.Second
}



// GetMaxFileSizeBytes 获取最大文件大小（字节）
func (c *UploadConfig) GetMaxFileSizeBytes() int64 {
	return int64(c.MaxFileSizeMB) * 1024 * 1024
}

// IsExtensionAllowed 检查文件扩展名是否允许
func (c *UploadConfig) IsExtensionAllowed(ext string) bool {
	for _, allowedExt := range c.AllowedExtensions {
		if ext == allowedExt {
			return true
		}
	}
	return false
}

// InitConfig 初始化配置
func InitConfig(configPath string) error {
	config, err := LoadConfig(configPath)
	if err != nil {
		return err
	}
	GlobalConfig = config
	return nil
}

// GetConfig 获取全局配置
func GetConfig() *Config {
	return GlobalConfig
}

// ReloadConfig 重新加载配置
func ReloadConfig() error {
	if GlobalConfig == nil {
		return fmt.Errorf("配置未初始化")
	}

	// 重新加载配置
	config, err := LoadConfig("")
	if err != nil {
		return err
	}

	GlobalConfig = config
	return nil
}

// SaveConfig 保存配置到文件
func SaveConfig(configPath string) error {
	if GlobalConfig == nil {
		return fmt.Errorf("配置未初始化")
	}

	if configPath == "" {
		executableDir, err := os.Executable()
		if err != nil {
			return fmt.Errorf("获取可执行文件路径失败: %v", err)
		}
		configPath = filepath.Join(filepath.Dir(executableDir), "config.yaml")
	}

	// 序列化为YAML
	data, err := yaml.Marshal(GlobalConfig)
	if err != nil {
		return fmt.Errorf("序列化配置失败: %v", err)
	}

	// 写入配置文件
	if err := os.WriteFile(configPath, data, os.FileMode(GlobalConfig.System.ConfigPermissions)); err != nil {
		return fmt.Errorf("写入配置文件失败: %v", err)
	}

	return nil
}
