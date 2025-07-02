package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx             context.Context
	dbService       *DatabaseService
	fileService     *FileService
	llmService      *LLMService
	instanceManager *InstanceManager
	cacheService    *CacheService
	config          *Config
}

// NewApp creates a new App application struct
func NewApp() *App {
	// 初始化配置
	err := InitConfig("config.yaml")
	if err != nil {
		log.Printf("Failed to load config: %v", err)
	}

	return &App{
		config: GetConfig(),
	}
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

	// 初始化LLM服务
	a.llmService = NewLLMService(&a.config.LLM)

	// 初始化缓存服务
	a.cacheService = NewCacheService(db)

	// 启动定期清理过期缓存的goroutine
	go a.startCacheCleanup()
}

// startCacheCleanup 启动定期清理过期缓存
func (a *App) startCacheCleanup() {
	ticker := time.NewTicker(1 * time.Hour) // 每小时清理一次
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 使用缓存服务清理过期缓存
			err := a.cacheService.CleanExpired()
			if err != nil {
				log.Printf("定期清理过期缓存失败: %v", err)
			}
		case <-a.ctx.Done():
			return
		}
	}
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

// convertFilesToTableNames 将文件名列表转换为表名列表
func (a *App) convertFilesToTableNames(filenames []string) []string {
	var tableNames []string
	allTables, err := a.GetTableList()
	if err != nil {
		return tableNames
	}

	for _, filename := range filenames {
		// 将文件名转换为表名（去掉扩展名，替换特殊字符）
		tableName := strings.TrimSuffix(filename, filepath.Ext(filename))
		tableName = strings.ReplaceAll(tableName, "-", "_")
		tableName = strings.ReplaceAll(tableName, " ", "_")

		// 检查表是否存在
		for _, existingTable := range allTables {
			if existingTable == tableName {
				tableNames = append(tableNames, tableName)
				break
			}
		}
	}

	return tableNames
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

// ProcessNaturalLanguage 处理自然语言输入（使用所有表）
func (a *App) ProcessNaturalLanguage(input string) (*LLMProcessResult, error) {
	return a.ProcessNaturalLanguageWithFiles(input, nil)
}

// ProcessNaturalLanguageWithFiles 处理自然语言输入（指定文件列表）
func (a *App) ProcessNaturalLanguageWithFiles(input string, selectedFiles []string) (*LLMProcessResult, error) {
	if input == "" {
		return nil, fmt.Errorf("输入不能为空")
	}

	// 检查是否为智能建议模式（以#bubu#开头）
	if strings.HasPrefix(input, "#bubu#") {
		// 智能建议模式：直接执行SQL，不走LLM
		return a.processTemplateMode(input, selectedFiles)
	}

	var tables []string
	var err error

	if selectedFiles != nil && len(selectedFiles) > 0 {
		// 如果指定了文件列表，只使用这些文件对应的表
		tables = a.convertFilesToTableNames(selectedFiles)
		if len(tables) == 0 {
			return nil, fmt.Errorf("选中的文件没有对应的数据表")
		}
	} else {
		// 如果没有指定文件，使用所有表
		tables, err = a.GetTableList()
		if err != nil {
			return nil, fmt.Errorf("获取表列表失败: %v", err)
		}
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

// SetLLMAPIKey 设置LLM API密钥
func (a *App) SetLLMAPIKey(apiKey string) error {
	a.llmService.SetAPIKey(apiKey)
	// 保存配置到文件
	return SaveConfig("config.yaml")
}

// SetLLMModel 设置LLM模型
func (a *App) SetLLMModel(modelID string) error {
	a.config.LLM.ModelID = modelID
	// 重新初始化客户端
	a.llmService.initClient()
	// 保存配置到文件
	return SaveConfig("config.yaml")
}

// ReloadConfig 重新加载配置
func (a *App) ReloadConfig() error {
	config, err := LoadConfig("config.yaml")
	if err != nil {
		return err
	}
	a.config = config
	// 重新初始化LLM服务
	a.llmService = NewLLMService(&config.LLM)
	return nil
}

// SetLLMTimeout 设置LLM请求超时时间（秒）
func (a *App) SetLLMTimeout(timeoutSeconds int) error {
	if timeoutSeconds <= 0 {
		return fmt.Errorf("超时时间必须大于0")
	}
	if timeoutSeconds > 300 {
		return fmt.Errorf("超时时间不能超过300秒")
	}

	a.config.LLM.TimeoutSeconds = timeoutSeconds
	// 保存配置到文件
	return SaveConfig("config.yaml")
}

// GetLLMTimeout 获取当前LLM请求超时时间（秒）
func (a *App) GetLLMTimeout() int {
	return a.config.LLM.TimeoutSeconds
}

// GetLLMConfig 获取LLM配置信息
func (a *App) GetLLMConfig() map[string]interface{} {
	return map[string]interface{}{
		"model":           a.config.LLM.ModelID,
		"timeout_seconds": a.config.LLM.TimeoutSeconds,
		"api_key_set":     a.config.LLM.APIKey != "",
		"base_url":        a.config.LLM.BaseURL,
	}
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
	uploadPath := filepath.Join(wd, GlobalConfig.Storage.Paths.UploadsDir)

	databasePath := filepath.Join(wd, GlobalConfig.Storage.Paths.DatabaseFile)

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

	// 使用新的Excel服务进行导出
	excelService := NewExcelService(GlobalConfig)

	// 配置导出选项
	options := &ExportOptions{
		SheetName:       "查询结果",
		IncludeHeader:   true,
		AutoWidth:       true,
		MaxRowsPerSheet: GlobalConfig.Export.MaxRows,
	}

	return excelService.ExportToExcelAdvanced(result, options)
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

// === 缓存辅助方法 ===

// generateDDLHash 生成DDL内容的哈希值
func (a *App) generateDDLHash(ddlContent string) string {
	hash := sha256.Sum256([]byte(ddlContent))
	return hex.EncodeToString(hash[:])
}

// === 缓存管理API ===

// ClearCacheByType 按类型清除缓存
func (a *App) ClearCacheByType(cacheType string) error {
	return a.cacheService.ClearByType(cacheType)
}

// ClearAllCache 清除所有缓存
func (a *App) ClearAllCache() error {
	return a.cacheService.ClearAll()
}

// GetCacheStats 获取缓存统计信息
func (a *App) GetCacheStats() (map[string]interface{}, error) {
	return a.cacheService.GetStats()
}

// ManualCleanExpiredCache 手动清理过期缓存
func (a *App) ManualCleanExpiredCache() error {
	return a.cacheService.CleanExpired()
}

// ProcessNaturalLanguageEnhanced 增强版自然语言处理（支持缓存复用）
func (a *App) ProcessNaturalLanguageEnhanced(input string) (*LLMProcessResult, error) {
	if input == "" {
		return nil, fmt.Errorf("输入不能为空")
	}

	// 获取表列表和DDL哈希
	tables, err := a.GetTableList()
	if err != nil {
		return nil, fmt.Errorf("获取表列表失败: %v", err)
	}
	ddlHash := a.calculateDDLHash(tables)

	// 尝试从提示词SQL映射中查找
	mapping, err := a.dbService.GetPromptSQLMapping(input, "default", ddlHash)
	if err != nil {
		log.Printf("查询提示词映射失败: %v", err)
	} else if mapping != nil {
		// 找到缓存的映射，更新使用统计
		err = a.dbService.UpdatePromptSQLMappingUsage(mapping.BusinessID, mapping.FileKey, ddlHash)
		if err != nil {
			log.Printf("更新使用统计失败: %v", err)
		}

		// 返回缓存的结果
		log.Printf("从缓存获取到提示词 '%s' 的SQL映射", input)
		return &LLMProcessResult{
			SQL:         mapping.SQL,
			BusinessID:  mapping.BusinessID,
			Definition:  mapping.Definition,
			Description: mapping.Description,
			Confidence:  mapping.Confidence,
			Suggestions: []string{}, // 缓存的结果不包含新建议
		}, nil
	}

	// 没有缓存，调用原始的LLM处理方法
	result, err := a.ProcessNaturalLanguage(input)
	if err != nil {
		return nil, err
	}

	// 保存新的提示词SQL映射
	newMapping := PromptSQLMapping{
		BusinessID:  result.BusinessID,
		FileKey:     "default",
		PromptText:  input,
		SQL:         result.SQL,
		Definition:  result.Definition,
		Description: result.Description,
		Confidence:  result.Confidence,
		DDLHash:     ddlHash,
		UsageCount:  1,
	}

	err = a.dbService.SavePromptSQLMapping(&newMapping)
	if err != nil {
		log.Printf("保存提示词SQL映射失败: %v", err)
	} else {
		log.Printf("成功保存新的提示词SQL映射: %s", input)
	}

	return result, nil
}

// GetPopularQueries 获取热门查询
func (a *App) GetPopularQueries(fileKey string, limit int) ([]PromptSQLMapping, error) {
	tables, err := a.GetTableList()
	if err != nil {
		return nil, fmt.Errorf("获取表列表失败: %v", err)
	}
	ddlHash := a.calculateDDLHash(tables)

	if fileKey == "" {
		fileKey = "default"
	}
	if limit <= 0 {
		limit = 10
	}

	return a.dbService.GetPopularPromptSQLMappings(fileKey, ddlHash, limit)
}

// processTemplateMode 处理智能建议模式
func (a *App) processTemplateMode(input string, selectedFiles []string) (*LLMProcessResult, error) {
	// 移除#bubu#前缀，提取实际的SQL内容
	sqlContent := strings.TrimPrefix(input, "#bubu#")
	sqlContent = strings.TrimSpace(sqlContent)

	if sqlContent == "" {
		return nil, fmt.Errorf("智能建议内容不能为空")
	}

	// 构建LLM处理结果（智能建议模式只返回SQL，不执行查询）
	result := &LLMProcessResult{
		SQL:         sqlContent,
		BusinessID:  "template_mode",
		Definition:  "通过智能建议直接查询数据库",
		Description: "这是一个保存的智能建议查询",
		Confidence:  1.0,
		Suggestions: []string{"这是一个保存的智能建议查询"},
		DebugInfo: &DebugInfo{
			ProcessingTime: 0, // 智能建议模式无需LLM处理时间
			APIEndpoint:    "template_mode",
		},
	}

	// 保存查询历史
	if saveErr := a.dbService.SaveQueryHistory(input, "template"); saveErr != nil {
		log.Printf("保存查询历史失败: %v", saveErr)
	}

	return result, nil
}

// === 会话相关API ===

// CreateConversation 创建一个新的会话（单文件）
func (a *App) CreateConversation(sessionID string, fileKey string, title string) (*Conversation, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("会话ID不能为空")
	}

	if fileKey == "" {
		fileKey = "default"
	}

	if title == "" {
		title = "新会话"
	}

	return a.dbService.CreateConversation(sessionID, fileKey, title)
}

// CreateConversationsForFiles 为多个文件创建会话
func (a *App) CreateConversationsForFiles(sessionID string, selectedFiles []string, title string) ([]*Conversation, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("会话ID不能为空")
	}

	if len(selectedFiles) == 0 {
		selectedFiles = []string{"default"}
	}

	if title == "" {
		title = "新会话"
	}

	var conversations []*Conversation
	for _, fileKey := range selectedFiles {
		conv, err := a.dbService.CreateConversation(sessionID, fileKey, title)
		if err != nil {
			return nil, err
		}
		conversations = append(conversations, conv)
	}

	return conversations, nil
}

// GetConversation 获取会话信息
func (a *App) GetConversation(sessionID string) (*Conversation, error) {
	return a.dbService.GetConversationBySessionID(sessionID)
}

// GetConversationsByFiles 根据文件获取会话列表
func (a *App) GetConversationsByFiles(selectedFiles []string) ([]Conversation, error) {
	if len(selectedFiles) == 0 {
		selectedFiles = []string{"default"}
	}
	return a.dbService.GetConversationsByFileKeys(selectedFiles)
}

// GetConversationsByFileKey 根据单个文件获取会话列表
func (a *App) GetConversationsByFileKey(fileKey string) ([]Conversation, error) {
	if fileKey == "" {
		fileKey = "default"
	}
	return a.dbService.GetConversationsByFileKey(fileKey)
}

// UpdateConversationTitle 更新会话标题
func (a *App) UpdateConversationTitle(sessionID, title string) error {
	return a.dbService.UpdateConversation(sessionID, title)
}

// SaveConversationMessage 保存会话消息
func (a *App) SaveConversationMessage(conversationID int, messageType, content, sql, queryResult, insights, suggestions, debugInfo string) error {
	message := &ConversationMessage{
		ConversationID: conversationID,
		MessageType:    messageType,
		Content:        content,
		SQL:            sql,
		QueryResult:    queryResult,
		Insights:       insights,
		Suggestions:    suggestions,
		DebugInfo:      debugInfo,
	}
	return a.dbService.SaveConversationMessage(message)
}

// GetConversationMessages 获取会话消息列表
func (a *App) GetConversationMessages(conversationID int) ([]ConversationMessage, error) {
	return a.dbService.GetConversationMessages(conversationID)
}

// === 智能建议相关API ===

// SaveTemplate 保存智能建议
func (a *App) SaveTemplate(selectedFiles []string, title, promptText, sql, description string) error {
	fileKeys := strings.Join(selectedFiles, ",")
	if fileKeys == "" {
		fileKeys = "default"
	}

	template := &SavedTemplate{
		FileKeys:    fileKeys,
		Title:       title,
		PromptText:  promptText,
		SQL:         sql,
		Description: description,
	}
	return a.dbService.SaveTemplate(template)
}

// GetTemplatesByFiles 根据文件获取智能建议列表
func (a *App) GetTemplatesByFiles(selectedFiles []string) ([]SavedTemplate, error) {
	fileKeys := strings.Join(selectedFiles, ",")
	if fileKeys == "" {
		fileKeys = "default"
	}
	return a.dbService.GetTemplatesByFileKeys(fileKeys)
}

// UpdateTemplate 更新智能建议
func (a *App) UpdateTemplate(id int, title, promptText, sql, description string) error {
	return a.dbService.UpdateTemplate(id, title, promptText, sql, description)
}

// UseTemplate 使用智能建议（更新使用统计）
func (a *App) UseTemplate(id int) error {
	return a.dbService.UpdateTemplateUsage(id)
}

// DeleteTemplate 删除智能建议
func (a *App) DeleteTemplate(id int) error {
	return a.dbService.DeleteTemplate(id)
}

// ExecuteTemplateSQL 执行智能建议SQL（带#bubu#前缀）
func (a *App) ExecuteTemplateSQL(sql string, selectedFiles []string) (*LLMProcessResult, error) {
	// 添加#bubu#前缀
	templateInput := "#bubu#" + sql
	return a.ProcessNaturalLanguageWithFiles(templateInput, selectedFiles)
}

// calculateDDLHash 计算DDL哈希值
func (a *App) calculateDDLHash(tables []string) string {
	// 简单的DDL哈希计算，实际应用中可以更复杂
	combined := strings.Join(tables, ",")
	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])
}

// ApplicationMenu 创建应用程序菜单（系统托盘）
func (a *App) ApplicationMenu() *menu.Menu {
	appMenu := menu.NewMenu()

	// 文件菜单
	fileMenu := appMenu.AddSubmenu("文件")
	fileMenu.AddText("打开文件", keys.CmdOrCtrl("o"), func(cd *menu.CallbackData) {
		// 触发文件选择
		runtime.EventsEmit(a.ctx, "open-file-dialog")
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("退出", keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		runtime.Quit(a.ctx)
	})

	// 窗口菜单
	windowMenu := appMenu.AddSubmenu("窗口")
	windowMenu.AddText("显示窗口", nil, func(cd *menu.CallbackData) {
		runtime.WindowShow(a.ctx)
		runtime.WindowUnminimise(a.ctx)
	})
	windowMenu.AddText("隐藏窗口", nil, func(cd *menu.CallbackData) {
		runtime.WindowHide(a.ctx)
	})
	windowMenu.AddSeparator()
	windowMenu.AddText("最小化", keys.CmdOrCtrl("m"), func(cd *menu.CallbackData) {
		runtime.WindowMinimise(a.ctx)
	})
	windowMenu.AddText("最大化", nil, func(cd *menu.CallbackData) {
		runtime.WindowMaximise(a.ctx)
	})

	// 帮助菜单
	helpMenu := appMenu.AddSubmenu("帮助")
	helpMenu.AddText("关于 BuBu BI", nil, func(cd *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "show-about-dialog")
	})

	return appMenu
}

// OnDomReady DOM准备就绪时的回调
func (a *App) OnDomReady(ctx context.Context) {
	// 发送欢迎通知
	a.ShowNotification("欢迎使用 BuBu BI", "智能数据分析助手已启动")
}

// ShowNotification 显示原生通知
func (a *App) ShowNotification(title, message string) {
	if a.ctx != nil {
		// 使用 Wails 运行时显示通知
		runtime.EventsEmit(a.ctx, "show-notification", map[string]string{
			"title":   title,
			"message": message,
		})
	}
}

// ShowSuccessNotification 显示成功通知
func (a *App) ShowSuccessNotification(message string) {
	a.ShowNotification("操作成功", message)
}

// ShowErrorNotification 显示错误通知
func (a *App) ShowErrorNotification(message string) {
	a.ShowNotification("操作失败", message)
}

// ToggleWindow 切换窗口显示/隐藏状态
func (a *App) ToggleWindow() {
	if a.ctx != nil {
		// 这里可以添加窗口状态检查逻辑
		runtime.WindowShow(a.ctx)
		runtime.WindowUnminimise(a.ctx)
	}
}
