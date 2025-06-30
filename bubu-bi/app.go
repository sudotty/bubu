package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// App struct
type App struct {
	ctx             context.Context
	dbService       *DatabaseService
	fileService     *FileService
	llmService      *LLMService
	instanceManager *InstanceManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// SetInstanceManager 设置实例管理器
func (a *App) SetInstanceManager(instanceManager *InstanceManager) {
	a.instanceManager = instanceManager
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 初始化数据库服务
	db, err := NewDatabaseService()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	a.dbService = db

	// 初始化文件服务
	a.fileService = NewFileService(db)

	// 初始化LLM服务并设置默认API密钥
	a.llmService = NewLLMService()
	// 硬编码火山引擎API密钥
	a.llmService.SetAPIKey("767a21c1-f1c4-446a-b34b-67cdf1cd9a7a")
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// UploadFile 上传文件
func (a *App) UploadFile(filename string, content string) (*File, error) {
	// Base64解码文件内容
	data, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		return nil, fmt.Errorf("文件内容解码失败: %v", err)
	}

	return a.fileService.UploadFile(filename, data)
}

// ExecuteSQL 执行SQL查询
func (a *App) ExecuteSQL(query string) (*QueryResult, error) {
	if query == "" {
		return nil, fmt.Errorf("查询语句不能为空")
	}

	// 保存查询历史
	err := a.dbService.SaveQueryHistory(query, "sql")
	if err != nil {
		log.Printf("保存查询历史失败: %v", err)
	}

	return a.dbService.ExecuteQuery(query)
}

// GetUploadedFiles 获取已上传的文件列表
func (a *App) GetUploadedFiles() ([]File, error) {
	return a.fileService.GetUploadedFiles()
}

// GetTableList 获取数据库表列表
func (a *App) GetTableList() ([]string, error) {
	return a.fileService.GetTableList()
}

// GetQueryHistory 获取查询历史
func (a *App) GetQueryHistory() ([]QueryHistory, error) {
	return a.dbService.GetQueryHistory(20)
}

// GetTableSchema 获取表结构
func (a *App) GetTableSchema(tableName string) (*QueryResult, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", tableName)
	return a.dbService.ExecuteQuery(query)
}

// GetTableData 获取表数据（分页）
func (a *App) GetTableData(tableName string, limit, offset int) (*QueryResult, error) {
	if limit <= 0 {
		limit = 100
	}
	query := fmt.Sprintf("SELECT * FROM `%s` LIMIT %d OFFSET %d", tableName, limit, offset)
	return a.dbService.ExecuteQuery(query)
}

// buildTableSchemaInfo 构建表结构信息
func (a *App) buildTableSchemaInfo(tables []string) string {
	var schemaInfo strings.Builder

	for _, table := range tables {
		schemaInfo.WriteString(fmt.Sprintf("表名: %s\n", table))

		// 获取表结构
		columns, err := a.GetTableColumns(table)
		if err != nil {
			continue
		}

		schemaInfo.WriteString("字段: ")
		schemaInfo.WriteString(strings.Join(columns, ", "))
		schemaInfo.WriteString("\n\n")
	}

	return schemaInfo.String()
}

// generateID 生成唯一ID
func (a *App) generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ===== LLM API相关 =====

// ProcessNaturalLanguage 处理自然语言输入并生成SQL
func (a *App) ProcessNaturalLanguage(input string) (*LLMProcessResult, error) {
	if input == "" {
		return nil, fmt.Errorf("输入不能为空")
	}

	// 获取所有表列表
	tables, err := a.GetTableList()
	if err != nil {
		return nil, fmt.Errorf("获取表列表失败: %v", err)
	}

	// 构建表结构信息
	tableSchema := a.buildTableSchemaInfo(tables)

	// 调用LLM服务处理自然语言
	result, err := a.llmService.ProcessNaturalLanguage(input, tableSchema, tables)
	if err != nil {
		return nil, err
	}

	// 保存查询历史
	err = a.dbService.SaveQueryHistory(input, "natural_language")
	if err != nil {
		log.Printf("保存查询历史失败: %v", err)
	}

	return result, nil
}

// ExecuteNaturalLanguageQuery 执行自然语言生成的SQL查询
func (a *App) ExecuteNaturalLanguageQuery(sql string) (*QueryResult, error) {
	if sql == "" {
		return nil, fmt.Errorf("SQL语句不能为空")
	}

	// 执行SQL查询
	return a.dbService.ExecuteQuery(sql)
}

// SetLLMAPIKey 设置LLM API密钥（保留接口但不再使用）
func (a *App) SetLLMAPIKey(apiKey string) {
	// 不再允许用户设置API密钥，使用硬编码的密钥
	// a.llmService.SetAPIKey(apiKey)
}

// GetTableColumns 获取表的列信息
func (a *App) GetTableColumns(tableName string) ([]string, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", tableName)
	rows, err := a.dbService.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var defaultValue interface{}

		err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk)
		if err != nil {
			continue
		}

		columns = append(columns, name)
	}

	return columns, nil
}

// SystemInfo 系统信息结构体
type SystemInfo struct {
	UploadPath   string `json:"upload_path"`
	DatabasePath string `json:"database_path"`
	UploadSize   int64  `json:"upload_size"`
	DatabaseSize int64  `json:"database_size"`
}

// GetSystemInfo 获取系统路径和文件大小信息
func (a *App) GetSystemInfo() (*SystemInfo, error) {
	// 获取当前工作目录
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("获取工作目录失败: %v", err)
	}

	// 上传目录路径
	uploadPath := filepath.Join(wd, "uploads")
	// 数据库文件路径
	databasePath := filepath.Join(wd, "bubu.db")

	// 获取上传目录大小
	uploadSize, err := getDirSize(uploadPath)
	if err != nil {
		uploadSize = 0 // 如果目录不存在或无法访问，设为0
	}

	// 获取数据库文件大小
	databaseSize, err := getFileSize(databasePath)
	if err != nil {
		databaseSize = 0 // 如果文件不存在，设为0
	}

	return &SystemInfo{
		UploadPath:   uploadPath,
		DatabasePath: databasePath,
		UploadSize:   uploadSize,
		DatabaseSize: databaseSize,
	}, nil
}

// getDirSize 计算目录大小
func getDirSize(path string) (int64, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

// getFileSize 获取文件大小
func getFileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

// ExecuteCommand 执行系统命令
func (a *App) ExecuteCommand(command string, args []string) error {
	cmd := exec.Command(command, args...)
	return cmd.Start()
}

// ExportToExcel 导出查询结果到Excel文件
func (a *App) ExportToExcel(query string) (string, error) {
	if query == "" {
		return "", fmt.Errorf("查询语句不能为空")
	}

	// 执行查询获取所有数据（不带LIMIT限制）
	// 移除查询中的LIMIT子句以获取所有数据
	fullQuery := removeLimitFromQuery(query)
	result, err := a.dbService.ExecuteQuery(fullQuery)
	if err != nil {
		return "", fmt.Errorf("查询执行失败: %v", err)
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("关闭Excel文件失败: %v", err)
		}
	}()

	// 设置工作表名称
	sheetName := "查询结果"
	f.SetSheetName("Sheet1", sheetName)

	// 写入表头
	for i, column := range result.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, column)
	}

	// 设置表头样式
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 12,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
		Border: []excelize.Border{
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
		},
	})
	if err == nil {
		headerRange := fmt.Sprintf("A1:%s1", string(rune('A'+len(result.Columns)-1)))
		f.SetCellStyle(sheetName, "A1", headerRange, headerStyle)
	}

	// 写入数据行
	for rowIndex, row := range result.Rows {
		for colIndex, cellValue := range row {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, rowIndex+2)
			// 处理不同类型的数据
			if cellValue == nil {
				f.SetCellValue(sheetName, cell, "")
			} else {
				f.SetCellValue(sheetName, cell, cellValue)
			}
		}
	}

	// 设置列宽自适应
	for i := 0; i < len(result.Columns); i++ {
		colName, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheetName, colName, colName, 15)
	}

	// 获取用户下载目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("获取用户主目录失败: %v", err)
	}
	downloadsDir := filepath.Join(homeDir, "Downloads")

	// 确保下载目录存在
	if err := os.MkdirAll(downloadsDir, 0755); err != nil {
		return "", fmt.Errorf("创建下载目录失败: %v", err)
	}

	// 生成文件名（包含时间戳）
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("查询结果_%s.xlsx", timestamp)
	filePath := filepath.Join(downloadsDir, filename)

	// 保存文件
	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("保存Excel文件失败: %v", err)
	}

	// 返回文件路径
	return filePath, nil
}

// GetInstallationInfo 获取安装信息
func (a *App) GetInstallationInfo() (*InstallationInfo, error) {
	if a.instanceManager == nil {
		return nil, fmt.Errorf("实例管理器未初始化")
	}
	return a.instanceManager.CheckInstallation()
}

// GetAppVersion 获取应用版本
func (a *App) GetAppVersion() string {
	return GetAppVersion()
}

// CheckForUpdates 检查更新（预留接口）
func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	// 这里可以实现检查更新的逻辑
	// 比如请求服务器API获取最新版本信息
	currentVersion := GetAppVersion()

	// 示例：模拟检查更新
	return &UpdateInfo{
		CurrentVersion: currentVersion,
		LatestVersion:  currentVersion, // 暂时返回当前版本
		HasUpdate:      false,
		UpdateURL:      "",
		ReleaseNotes:   "",
	}, nil
}

// UpdateInfo 更新信息
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	UpdateURL      string `json:"updateUrl"`
	ReleaseNotes   string `json:"releaseNotes"`
}

// RestartApplication 重启应用（用于更新后重启）
func (a *App) RestartApplication() error {
	if a.instanceManager != nil {
		a.instanceManager.Cleanup()
	}

	// 获取当前执行文件路径
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("获取执行文件路径失败: %v", err)
	}

	// 启动新进程
	cmd := exec.Command(executable)
	cmd.Start()

	// 退出当前进程
	os.Exit(0)
	return nil
}

// removeLimitFromQuery 移除SQL查询中的LIMIT子句
func removeLimitFromQuery(query string) string {
	// 简单的LIMIT移除逻辑
	// 这里使用简单的字符串替换，实际项目中可能需要更复杂的SQL解析
	lowerQuery := strings.ToLower(query)
	limitIndex := strings.LastIndex(lowerQuery, "limit")
	if limitIndex != -1 {
		// 找到LIMIT关键字，移除从LIMIT开始到查询结束的部分
		return strings.TrimSpace(query[:limitIndex])
	}
	return query
}
