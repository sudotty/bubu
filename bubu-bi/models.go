package main

import (
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// File 文件信息结构体
type File struct {
	ID         int       `json:"id"`
	Filename   string    `json:"filename"`
	FilePath   string    `json:"file_path"`
	FileSize   int64     `json:"file_size"`
	UploadTime time.Time `json:"upload_time"`
	FileType   string    `json:"file_type"`
	Status     string    `json:"status"`
}

// QueryResult 查询结果结构体
type QueryResult struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
	Total   int             `json:"total"`
}

// QueryHistory 查询历史结构体
type QueryHistory struct {
	ID        int       `json:"id"`
	Query     string    `json:"query"`
	QueryType string    `json:"query_type"` // sql, natural
	CreatedAt time.Time `json:"created_at"`
}

// CacheEntry 通用缓存条目结构体
type CacheEntry struct {
	ID         int       `json:"id"`
	CacheKey   string    `json:"cache_key"`   // 缓存键
	CacheType  string    `json:"cache_type"`  // 缓存类型标识
	CacheValue string    `json:"cache_value"` // 缓存值（JSON格式）
	Metadata   string    `json:"metadata"`    // 元数据（如DDL哈希等）
	ExpiresAt  time.Time `json:"expires_at"`  // 过期时间
	CreatedAt  time.Time `json:"created_at"`  // 创建时间
	UpdatedAt  time.Time `json:"updated_at"`  // 更新时间
}





// PromptSQLMapping 提示词与SQL映射关系
type PromptSQLMapping struct {
	ID          int       `json:"id"`
	BusinessID  string    `json:"business_id"`  // 业务唯一标识
	FileKey     string    `json:"file_key"`     // 文件标识
	PromptText  string    `json:"prompt_text"`  // 原始提示词
	SQL         string    `json:"sql"`          // 生成的SQL
	Definition  string    `json:"definition"`   // 业务定义
	Description string    `json:"description"`  // 详细描述
	Confidence  float64   `json:"confidence"`   // 置信度
	DDLHash     string    `json:"ddl_hash"`     // DDL哈希值
	UsageCount  int       `json:"usage_count"`  // 使用次数
	LastUsedAt  time.Time `json:"last_used_at"` // 最后使用时间
	CreatedAt   time.Time `json:"created_at"`   // 创建时间
	UpdatedAt   time.Time `json:"updated_at"`   // 更新时间
}

// Conversation 会话结构体
type Conversation struct {
	ID          int       `json:"id"`
	SessionID   string    `json:"session_id"`   // 会话唯一标识
	FileKeys    string    `json:"file_keys"`    // 关联的文件列表（JSON格式）
	Title       string    `json:"title"`        // 会话标题
	CreatedAt   time.Time `json:"created_at"`   // 创建时间
	UpdatedAt   time.Time `json:"updated_at"`   // 更新时间
}

// ConversationMessage 会话消息结构体
type ConversationMessage struct {
	ID             int       `json:"id"`
	ConversationID int       `json:"conversation_id"` // 关联的会话ID
	MessageType    string    `json:"message_type"`    // user, assistant, error
	Content        string    `json:"content"`         // 消息内容
	SQL            string    `json:"sql"`             // 相关的SQL（如果有）
	QueryResult    string    `json:"query_result"`    // 查询结果（JSON格式）
	Insights       string    `json:"insights"`        // 洞察信息（JSON格式）
	Suggestions    string    `json:"suggestions"`     // 建议信息（JSON格式）
	DebugInfo      string    `json:"debug_info"`      // 调试信息（JSON格式）
	CreatedAt      time.Time `json:"created_at"`      // 创建时间
}

// SavedTemplate 保存的话术本结构体
type SavedTemplate struct {
	ID          int       `json:"id"`
	FileKeys    string    `json:"file_keys"`    // 关联的文件列表（JSON格式）
	Title       string    `json:"title"`        // 话术标题
	PromptText  string    `json:"prompt_text"`  // 话术内容
	SQL         string    `json:"sql"`          // 对应的SQL
	Description string    `json:"description"`  // 描述
	UsageCount  int       `json:"usage_count"`  // 使用次数
	LastUsedAt  time.Time `json:"last_used_at"` // 最后使用时间
	CreatedAt   time.Time `json:"created_at"`   // 创建时间
	UpdatedAt   time.Time `json:"updated_at"`   // 更新时间
}

// DatabaseService 数据库服务
type DatabaseService struct {
	db *sql.DB
}

// NewDatabaseService 创建数据库服务
func NewDatabaseService() (*DatabaseService, error) {
	db, err := sql.Open("sqlite3", "./bubu.db")
	if err != nil {
		return nil, err
	}

	service := &DatabaseService{db: db}
	err = service.initTables()
	if err != nil {
		return nil, err
	}

	return service, nil
}

// initTables 初始化数据库表
func (ds *DatabaseService) initTables() error {
	// 创建文件管理表
	filesTable := `
	CREATE TABLE IF NOT EXISTS files (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		filename TEXT NOT NULL,
		file_path TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// 创建查询历史表
	queryHistoryTable := `
	CREATE TABLE IF NOT EXISTS query_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		query TEXT NOT NULL,
		query_type TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// 创建通用缓存表
	cacheTable := `
	CREATE TABLE IF NOT EXISTS cache_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cache_key TEXT NOT NULL,
		cache_type TEXT NOT NULL,
		cache_value TEXT NOT NULL,
		metadata TEXT,
		expires_at DATETIME NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(cache_key, cache_type)
	);`

	// 创建智能建议缓存表

	

	// 创建提示词SQL映射表
	promptSQLMappingTable := `
	CREATE TABLE IF NOT EXISTS prompt_sql_mappings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		business_id TEXT NOT NULL,
		file_key TEXT NOT NULL,
		prompt_text TEXT NOT NULL,
		sql TEXT NOT NULL,
		definition TEXT,
		description TEXT,
		confidence REAL DEFAULT 0.0,
		ddl_hash TEXT,
		usage_count INTEGER DEFAULT 1,
		last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(business_id, file_key, ddl_hash)
	);`

	// 创建会话表
	conversationTable := `
	CREATE TABLE IF NOT EXISTS conversations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL UNIQUE,
		file_keys TEXT NOT NULL,
		title TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// 创建会话消息表
	conversationMessageTable := `
	CREATE TABLE IF NOT EXISTS conversation_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		conversation_id INTEGER NOT NULL,
		message_type TEXT NOT NULL,
		content TEXT NOT NULL,
		sql TEXT,
		query_result TEXT,
		insights TEXT,
		suggestions TEXT,
		debug_info TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
	);`

	// 创建保存的话术本表
	savedTemplateTable := `
	CREATE TABLE IF NOT EXISTS saved_templates (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		file_keys TEXT NOT NULL,
		title TEXT NOT NULL,
		prompt_text TEXT NOT NULL,
		sql TEXT NOT NULL,
		description TEXT,
		usage_count INTEGER DEFAULT 0,
		last_used_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// 创建缓存表索引
	cacheIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_cache_entries_type_key ON cache_entries(cache_type, cache_key);`,
		`CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);`,
		`CREATE INDEX IF NOT EXISTS idx_business_suggestions_file_key ON business_suggestions(file_key, ddl_hash);`,
		`CREATE INDEX IF NOT EXISTS idx_business_suggestions_business_id ON business_suggestions(business_id);`,
		`CREATE INDEX IF NOT EXISTS idx_prompt_sql_mappings_file_key ON prompt_sql_mappings(file_key, ddl_hash);`,
		`CREATE INDEX IF NOT EXISTS idx_prompt_sql_mappings_business_id ON prompt_sql_mappings(business_id);`,
		`CREATE INDEX IF NOT EXISTS idx_prompt_sql_mappings_usage ON prompt_sql_mappings(usage_count DESC, last_used_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);`,
		`CREATE INDEX IF NOT EXISTS idx_conversations_file_keys ON conversations(file_keys);`,
		`CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);`,
		`CREATE INDEX IF NOT EXISTS idx_saved_templates_file_keys ON saved_templates(file_keys);`,
		`CREATE INDEX IF NOT EXISTS idx_saved_templates_usage ON saved_templates(usage_count DESC, last_used_at DESC);`,
	}

	// 执行所有表创建语句
	tables := []string{filesTable, queryHistoryTable, cacheTable, promptSQLMappingTable, conversationTable, conversationMessageTable, savedTemplateTable}
	for _, table := range tables {
		_, err := ds.db.Exec(table)
		if err != nil {
			return err
		}
	}

	// 创建索引
	for _, index := range cacheIndexes {
		_, err := ds.db.Exec(index)
		if err != nil {
			return err
		}
	}

	return nil
}

// ExecuteQuery 执行SQL查询
func (ds *DatabaseService) ExecuteQuery(query string) (*QueryResult, error) {
	rows, err := ds.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// 获取列名
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	// 准备结果
	result := &QueryResult{
		Columns: columns,
		Rows:    make([][]interface{}, 0),
	}

	// 读取数据
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		err := rows.Scan(valuePtrs...)
		if err != nil {
			return nil, err
		}

		// 转换字节数组为字符串
		for i, val := range values {
			if b, ok := val.([]byte); ok {
				values[i] = string(b)
			}
		}

		result.Rows = append(result.Rows, values)
	}

	result.Total = len(result.Rows)
	return result, nil
}

// SaveQueryHistory 保存查询历史
func (ds *DatabaseService) SaveQueryHistory(query, queryType string) error {
	_, err := ds.db.Exec("INSERT INTO query_history (query, query_type) VALUES (?, ?)", query, queryType)
	return err
}

// GetQueryHistory 获取查询历史
func (ds *DatabaseService) GetQueryHistory(limit int) ([]QueryHistory, error) {
	rows, err := ds.db.Query("SELECT id, query, query_type, created_at FROM query_history ORDER BY created_at DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []QueryHistory
	for rows.Next() {
		var h QueryHistory
		err := rows.Scan(&h.ID, &h.Query, &h.QueryType, &h.CreatedAt)
		if err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	return history, nil
}

// Close 关闭数据库连接
func (ds *DatabaseService) Close() error {
	return ds.db.Close()
}

// === 缓存相关方法 ===

// SetCache 设置通用缓存
func (ds *DatabaseService) SetCache(cacheKey, cacheType, cacheValue, metadata string, expiresAt time.Time) error {
	_, err := ds.db.Exec(`
		INSERT OR REPLACE INTO cache_entries 
		(cache_key, cache_type, cache_value, metadata, expires_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		cacheKey, cacheType, cacheValue, metadata, expiresAt)
	return err
}

// GetCache 获取通用缓存
func (ds *DatabaseService) GetCache(cacheKey, cacheType string) (*CacheEntry, error) {
	var entry CacheEntry
	err := ds.db.QueryRow(`
		SELECT id, cache_key, cache_type, cache_value, metadata, expires_at, created_at, updated_at 
		FROM cache_entries 
		WHERE cache_key = ? AND cache_type = ? AND expires_at > CURRENT_TIMESTAMP`,
		cacheKey, cacheType).Scan(
		&entry.ID, &entry.CacheKey, &entry.CacheType, &entry.CacheValue,
		&entry.Metadata, &entry.ExpiresAt, &entry.CreatedAt, &entry.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &entry, err
}

// DeleteCache 删除指定缓存
func (ds *DatabaseService) DeleteCache(cacheKey, cacheType string) error {
	_, err := ds.db.Exec("DELETE FROM cache_entries WHERE cache_key = ? AND cache_type = ?", cacheKey, cacheType)
	return err
}

// ClearExpiredCache 清理过期缓存
func (ds *DatabaseService) ClearExpiredCache() error {
	_, err := ds.db.Exec("DELETE FROM cache_entries WHERE expires_at <= CURRENT_TIMESTAMP")
	return err
}






// === 提示词SQL映射相关方法 ===

// SavePromptSQLMapping 保存提示词SQL映射
func (ds *DatabaseService) SavePromptSQLMapping(mapping *PromptSQLMapping) error {
	_, err := ds.db.Exec(`
		INSERT OR REPLACE INTO prompt_sql_mappings 
		(business_id, file_key, prompt_text, sql, definition, description, confidence, ddl_hash, usage_count, last_used_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		mapping.BusinessID, mapping.FileKey, mapping.PromptText, mapping.SQL,
		mapping.Definition, mapping.Description, mapping.Confidence, mapping.DDLHash, mapping.UsageCount)
	return err
}

// GetPromptSQLMapping 根据提示词查找SQL映射
func (ds *DatabaseService) GetPromptSQLMapping(promptText, fileKey, ddlHash string) (*PromptSQLMapping, error) {
	var m PromptSQLMapping
	err := ds.db.QueryRow(`
		SELECT id, business_id, file_key, prompt_text, sql, definition, description, confidence, ddl_hash, usage_count, last_used_at, created_at, updated_at 
		FROM prompt_sql_mappings 
		WHERE prompt_text = ? AND file_key = ? AND ddl_hash = ?`,
		promptText, fileKey, ddlHash).Scan(
		&m.ID, &m.BusinessID, &m.FileKey, &m.PromptText, &m.SQL,
		&m.Definition, &m.Description, &m.Confidence, &m.DDLHash,
		&m.UsageCount, &m.LastUsedAt, &m.CreatedAt, &m.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &m, err
}

// UpdatePromptSQLMappingUsage 更新提示词SQL映射的使用统计
func (ds *DatabaseService) UpdatePromptSQLMappingUsage(businessID, fileKey, ddlHash string) error {
	_, err := ds.db.Exec(`
		UPDATE prompt_sql_mappings 
		SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE business_id = ? AND file_key = ? AND ddl_hash = ?`,
		businessID, fileKey, ddlHash)
	return err
}

// GetPopularPromptSQLMappings 获取热门的提示词SQL映射
func (ds *DatabaseService) GetPopularPromptSQLMappings(fileKey, ddlHash string, limit int) ([]PromptSQLMapping, error) {
	rows, err := ds.db.Query(`
		SELECT id, business_id, file_key, prompt_text, sql, definition, description, confidence, ddl_hash, usage_count, last_used_at, created_at, updated_at 
		FROM prompt_sql_mappings 
		WHERE file_key = ? AND ddl_hash = ?
		ORDER BY usage_count DESC, last_used_at DESC
		LIMIT ?`,
		fileKey, ddlHash, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mappings []PromptSQLMapping
	for rows.Next() {
		var m PromptSQLMapping
		err := rows.Scan(&m.ID, &m.BusinessID, &m.FileKey, &m.PromptText, &m.SQL,
			&m.Definition, &m.Description, &m.Confidence, &m.DDLHash,
			&m.UsageCount, &m.LastUsedAt, &m.CreatedAt, &m.UpdatedAt)
		if err != nil {
			return nil, err
		}
		mappings = append(mappings, m)
	}
	return mappings, nil
}

// === 会话相关方法 ===

// CreateConversation 创建新会话
func (ds *DatabaseService) CreateConversation(sessionID, fileKeys, title string) (*Conversation, error) {
	result, err := ds.db.Exec(`
		INSERT INTO conversations (session_id, file_keys, title) 
		VALUES (?, ?, ?)`,
		sessionID, fileKeys, title)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return &Conversation{
		ID:        int(id),
		SessionID: sessionID,
		FileKeys:  fileKeys,
		Title:     title,
	}, nil
}

// GetConversationBySessionID 根据会话ID获取会话
func (ds *DatabaseService) GetConversationBySessionID(sessionID string) (*Conversation, error) {
	var c Conversation
	err := ds.db.QueryRow(`
		SELECT id, session_id, file_keys, title, created_at, updated_at 
		FROM conversations 
		WHERE session_id = ?`,
		sessionID).Scan(&c.ID, &c.SessionID, &c.FileKeys, &c.Title, &c.CreatedAt, &c.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

// GetConversationsByFileKeys 根据文件键获取会话列表
func (ds *DatabaseService) GetConversationsByFileKeys(fileKeys string) ([]Conversation, error) {
	rows, err := ds.db.Query(`
		SELECT id, session_id, file_keys, title, created_at, updated_at 
		FROM conversations 
		WHERE file_keys = ? 
		ORDER BY updated_at DESC`,
		fileKeys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []Conversation
	for rows.Next() {
		var c Conversation
		err := rows.Scan(&c.ID, &c.SessionID, &c.FileKeys, &c.Title, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		conversations = append(conversations, c)
	}
	return conversations, nil
}

// UpdateConversation 更新会话
func (ds *DatabaseService) UpdateConversation(sessionID, title string) error {
	_, err := ds.db.Exec(`
		UPDATE conversations 
		SET title = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE session_id = ?`,
		title, sessionID)
	return err
}

// === 会话消息相关方法 ===

// SaveConversationMessage 保存会话消息
func (ds *DatabaseService) SaveConversationMessage(message *ConversationMessage) error {
	_, err := ds.db.Exec(`
		INSERT INTO conversation_messages 
		(conversation_id, message_type, content, sql, query_result, insights, suggestions, debug_info) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		message.ConversationID, message.MessageType, message.Content, message.SQL,
		message.QueryResult, message.Insights, message.Suggestions, message.DebugInfo)
	return err
}

// GetConversationMessages 获取会话消息列表
func (ds *DatabaseService) GetConversationMessages(conversationID int) ([]ConversationMessage, error) {
	rows, err := ds.db.Query(`
		SELECT id, conversation_id, message_type, content, sql, query_result, insights, suggestions, debug_info, created_at 
		FROM conversation_messages 
		WHERE conversation_id = ? 
		ORDER BY created_at ASC`,
		conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []ConversationMessage
	for rows.Next() {
		var m ConversationMessage
		err := rows.Scan(&m.ID, &m.ConversationID, &m.MessageType, &m.Content,
			&m.SQL, &m.QueryResult, &m.Insights, &m.Suggestions, &m.DebugInfo, &m.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}

// === 话术本相关方法 ===

// SaveTemplate 保存话术本
func (ds *DatabaseService) SaveTemplate(template *SavedTemplate) error {
	_, err := ds.db.Exec(`
		INSERT INTO saved_templates 
		(file_keys, title, prompt_text, sql, description) 
		VALUES (?, ?, ?, ?, ?)`,
		template.FileKeys, template.Title, template.PromptText, template.SQL, template.Description)
	return err
}

// GetTemplatesByFileKeys 根据文件键获取话术本列表
func (ds *DatabaseService) GetTemplatesByFileKeys(fileKeys string) ([]SavedTemplate, error) {
	rows, err := ds.db.Query(`
		SELECT id, file_keys, title, prompt_text, sql, description, usage_count, last_used_at, created_at, updated_at 
		FROM saved_templates 
		WHERE file_keys = ? 
		ORDER BY usage_count DESC, last_used_at DESC`,
		fileKeys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []SavedTemplate
	for rows.Next() {
		var t SavedTemplate
		err := rows.Scan(&t.ID, &t.FileKeys, &t.Title, &t.PromptText, &t.SQL,
			&t.Description, &t.UsageCount, &t.LastUsedAt, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// UpdateTemplate 更新话术本
func (ds *DatabaseService) UpdateTemplate(id int, title, promptText, sql, description string) error {
	_, err := ds.db.Exec(`
		UPDATE saved_templates 
		SET title = ?, prompt_text = ?, sql = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?`,
		title, promptText, sql, description, id)
	return err
}

// UpdateTemplateUsage 更新话术本使用统计
func (ds *DatabaseService) UpdateTemplateUsage(id int) error {
	_, err := ds.db.Exec(`
		UPDATE saved_templates 
		SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?`,
		id)
	return err
}

// DeleteTemplate 删除话术本
func (ds *DatabaseService) DeleteTemplate(id int) error {
	_, err := ds.db.Exec("DELETE FROM saved_templates WHERE id = ?", id)
	return err
}
