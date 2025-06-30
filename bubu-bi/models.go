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

	// 执行所有表创建语句
	tables := []string{filesTable, queryHistoryTable}
	for _, table := range tables {
		_, err := ds.db.Exec(table)
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
