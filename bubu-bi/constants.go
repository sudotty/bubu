package main

// 系统常量 - 真正不可变的常量
const (
	// 应用信息
	AppName    = "Bubu BI"
	AppVersion = "1.0.0"

	// 文件类型常量
	FileTypeCSV  = ".csv"
	FileTypeXLSX = ".xlsx"
	FileTypeXLS  = ".xls"

	// 导出格式常量
	ExportFormatXLSX = "xlsx"
	ExportFormatCSV  = "csv"

	// 日志级别常量
	LogLevelDebug = "debug"
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"

	// HTTP状态相关常量
	StatusSuccess = "success"
	StatusError   = "error"
	StatusPending = "pending"

	// 配置文件名
	ConfigFileName = "config.yaml"
)

// 支持的文件扩展名
var (
	SupportedFileExtensions = []string{FileTypeCSV, FileTypeXLSX, FileTypeXLS}
)