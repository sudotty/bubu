package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// FileService 文件处理服务
type FileService struct {
	db       *DatabaseService
	uploadDir string
}

// NewFileService 创建文件服务
func NewFileService(db *DatabaseService) *FileService {
	uploadDir := "./uploads"
	os.MkdirAll(uploadDir, os.FileMode(GlobalConfig.System.FilePermissions))
	return &FileService{
		db:        db,
		uploadDir: uploadDir,
	}
}

// UploadFile 上传文件
func (fs *FileService) UploadFile(filename string, content []byte) (*File, error) {
	// 检查文件类型
	ext := strings.ToLower(filepath.Ext(filename))
	var fileType string
	
	// 检查是否为支持的扩展名
	supported := false
	for _, supportedExt := range GlobalConfig.FileHandling.Processing.SupportedExtensions {
		if ext == supportedExt {
			supported = true
			break
		}
	}
	
	if !supported {
		return nil, fmt.Errorf("不支持的文件类型: %s", ext)
	}
	
	switch ext {
	case ".xlsx", ".xls":
		fileType = "xlsx"
	case ".csv":
		fileType = "csv"
	default:
		fileType = "unknown"
	}

	// 保存文件
	filePath := filepath.Join(fs.uploadDir, filename)
	err := os.WriteFile(filePath, content, os.FileMode(GlobalConfig.System.ConfigPermissions))
	if err != nil {
		return nil, err
	}

	// 获取文件信息
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	// 创建文件记录
	file := &File{
		Filename:   filename,
		FilePath:   filePath,
		FileType:   fileType,
		UploadTime: time.Now(),
		FileSize:   fileInfo.Size(),
		Status:     "active",
	}

	// 解析文件并导入数据库
	err = fs.importFileToDatabase(file)
	if err != nil {
		return nil, err
	}

	return file, nil
}

// importFileToDatabase 将文件数据导入数据库
func (fs *FileService) importFileToDatabase(file *File) error {
	var data [][]string
	var err error

	switch file.FileType {
	case "xlsx":
		data, err = fs.parseExcelFile(file.FilePath)
	case "csv":
		data, err = fs.parseCSVFile(file.FilePath)
	default:
		return fmt.Errorf("不支持的文件类型: %s", file.FileType)
	}

	if err != nil {
		return err
	}

	if len(data) == 0 {
		return fmt.Errorf("文件为空")
	}

	// 创建表名（去掉扩展名）
	tableName := strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
	tableName = strings.ReplaceAll(tableName, "-", "_")
	tableName = strings.ReplaceAll(tableName, " ", "_")

	// 创建表
	err = fs.createTableFromData(tableName, data)
	if err != nil {
		return err
	}

	// 插入数据
	err = fs.insertDataToTable(tableName, data)
	return err
}

// parseExcelFile 解析Excel文件
func (fs *FileService) parseExcelFile(filePath string) ([][]string, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// 获取第一个工作表
	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, err
	}

	return rows, nil
}

// parseCSVFile 解析CSV文件
func (fs *FileService) parseCSVFile(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // 允许不同行有不同的字段数

	var rows [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		rows = append(rows, record)
	}

	return rows, nil
}

// createTableFromData 根据数据创建表
func (fs *FileService) createTableFromData(tableName string, data [][]string) error {
	if len(data) == 0 {
		return fmt.Errorf("数据为空")
	}

	// 使用第一行作为列名
	headers := data[0]
	if len(headers) == 0 {
		return fmt.Errorf("没有列名")
	}

	// 构建CREATE TABLE语句
	var columns []string
	for i, header := range headers {
		// 清理列名
		columnName := strings.TrimSpace(header)
		if columnName == "" {
			columnName = fmt.Sprintf("column_%d", i+1)
		}
		// 替换特殊字符
		columnName = strings.ReplaceAll(columnName, " ", "_")
		columnName = strings.ReplaceAll(columnName, "-", "_")
		columns = append(columns, fmt.Sprintf("`%s` TEXT", columnName))
	}

	// 删除已存在的表
	dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS `%s`", tableName)
	_, err := fs.db.db.Exec(dropSQL)
	if err != nil {
		return err
	}

	// 创建新表
	createSQL := fmt.Sprintf("CREATE TABLE `%s` (id INTEGER PRIMARY KEY AUTOINCREMENT, %s)", tableName, strings.Join(columns, ", "))
	_, err = fs.db.db.Exec(createSQL)
	return err
}

// insertDataToTable 插入数据到表
func (fs *FileService) insertDataToTable(tableName string, data [][]string) error {
	if len(data) <= 1 {
		return nil // 只有表头，没有数据
	}

	headers := data[0]
	rows := data[1:]

	// 构建INSERT语句
	placeholders := make([]string, len(headers))
	for i := range placeholders {
		placeholders[i] = "?"
	}

	columnNames := make([]string, len(headers))
	for i, header := range headers {
		columnName := strings.TrimSpace(header)
		if columnName == "" {
			columnName = fmt.Sprintf("column_%d", i+1)
		}
		columnName = strings.ReplaceAll(columnName, " ", "_")
		columnName = strings.ReplaceAll(columnName, "-", "_")
		columnNames[i] = fmt.Sprintf("`%s`", columnName)
	}

	insertSQL := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES (%s)", tableName, strings.Join(columnNames, ", "), strings.Join(placeholders, ", "))

	// 批量插入数据
	tx, err := fs.db.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(insertSQL)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, row := range rows {
		// 确保行数据长度与列数匹配
		values := make([]interface{}, len(headers))
		for i := 0; i < len(headers); i++ {
			if i < len(row) {
				values[i] = row[i]
			} else {
				values[i] = ""
			}
		}

		_, err = stmt.Exec(values...)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetUploadedFiles 获取已上传的文件列表
func (fs *FileService) GetUploadedFiles() ([]File, error) {
	files, err := os.ReadDir(fs.uploadDir)
	if err != nil {
		return nil, err
	}

	var result []File
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		ext := strings.ToLower(filepath.Ext(file.Name()))
		var fileType string
		
		// 检查是否为支持的扩展名
		supported := false
		for _, supportedExt := range GlobalConfig.FileHandling.Processing.SupportedExtensions {
			if ext == supportedExt {
				supported = true
				break
			}
		}
		
		if !supported {
			continue
		}
		
		switch ext {
		case ".xlsx", ".xls":
			fileType = "xlsx"
		case ".csv":
			fileType = "csv"
		default:
			fileType = "unknown"
		}

		result = append(result, File{
			Filename:   file.Name(),
			FilePath:   filepath.Join(fs.uploadDir, file.Name()),
			FileType:   fileType,
			UploadTime: info.ModTime(),
			FileSize:   info.Size(),
			Status:     "active",
		})
	}

	return result, nil
}

// GetTableList 获取数据库中的表列表
func (fs *FileService) GetTableList() ([]string, error) {
	rows, err := fs.db.db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('files', 'query_history')")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		err := rows.Scan(&tableName)
		if err != nil {
			return nil, err
		}
		tables = append(tables, tableName)
	}

	return tables, nil
}