package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ExcelService Excel处理服务
type ExcelService struct {
	config *Config
}

// NewExcelService 创建Excel服务实例
func NewExcelService(config *Config) *ExcelService {
	return &ExcelService{
		config: config,
	}
}

// ExcelProcessOptions Excel处理选项
type ExcelProcessOptions struct {
	SheetName    string // 指定工作表名称
	StartRow     int    // 开始行号（1-based）
	MaxRows      int    // 最大读取行数，0表示无限制
	SkipEmpty    bool   // 跳过空行
	TrimSpaces   bool   // 去除单元格前后空格
}

// DefaultExcelOptions 默认Excel处理选项
func DefaultExcelOptions() *ExcelProcessOptions {
	return &ExcelProcessOptions{
		SheetName:  "", // 空字符串表示使用第一个工作表
		StartRow:   1,
		MaxRows:    0,
		SkipEmpty:  true,
		TrimSpaces: true,
	}
}

// ParseExcelFileStream 流式解析Excel文件（适用于大文件）
func (es *ExcelService) ParseExcelFileStream(filePath string, options *ExcelProcessOptions) ([][]string, error) {
	if options == nil {
		options = DefaultExcelOptions()
	}

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开Excel文件失败: %v", err)
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("关闭Excel文件失败: %v", err)
		}
	}()

	// 获取工作表名称
	sheetName := options.SheetName
	if sheetName == "" {
		sheetName = f.GetSheetName(0)
		if sheetName == "" {
			return nil, fmt.Errorf("无法获取工作表名称")
		}
	}

	// 检查工作表是否存在
	sheetList := f.GetSheetList()
	sheetExists := false
	for _, name := range sheetList {
		if name == sheetName {
			sheetExists = true
			break
		}
	}
	if !sheetExists {
		return nil, fmt.Errorf("工作表 '%s' 不存在", sheetName)
	}

	// 使用流式读取器处理大文件
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("读取工作表数据失败: %v", err)
	}

	var result [][]string
	processedRows := 0

	for i, row := range rows {
		// 跳过指定的开始行之前的行
		if i+1 < options.StartRow {
			continue
		}

		// 检查最大行数限制
		if options.MaxRows > 0 && processedRows >= options.MaxRows {
			break
		}

		// 跳过空行
		if options.SkipEmpty && es.isEmptyRow(row) {
			continue
		}

		// 处理行数据
		processedRow := make([]string, len(row))
		for j, cell := range row {
			if options.TrimSpaces {
				processedRow[j] = strings.TrimSpace(cell)
			} else {
				processedRow[j] = cell
			}
		}

		result = append(result, processedRow)
		processedRows++
	}

	log.Printf("Excel文件解析完成: 工作表=%s, 处理行数=%d", sheetName, processedRows)
	return result, nil
}

// isEmptyRow 检查行是否为空
func (es *ExcelService) isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// ExportOptions Excel导出选项
type ExportOptions struct {
	SheetName     string
	IncludeHeader bool
	AutoWidth     bool
	HeaderStyle   *excelize.Style
	DataStyle     *excelize.Style
	MaxRowsPerSheet int // 每个工作表最大行数，超过则创建新工作表
}

// DefaultExportOptions 默认导出选项
func DefaultExportOptions() *ExportOptions {
	return &ExportOptions{
		SheetName:     "数据",
		IncludeHeader: true,
		AutoWidth:     true,
		HeaderStyle: &excelize.Style{
			Font: &excelize.Font{
				Bold: true,
				Size: 12,
				Color: "#000000",
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
			Alignment: &excelize.Alignment{
				Horizontal: "center",
				Vertical:   "center",
			},
		},
		DataStyle: &excelize.Style{
			Border: []excelize.Border{
				{Type: "left", Color: "#CCCCCC", Style: 1},
				{Type: "top", Color: "#CCCCCC", Style: 1},
				{Type: "bottom", Color: "#CCCCCC", Style: 1},
				{Type: "right", Color: "#CCCCCC", Style: 1},
			},
		},
		MaxRowsPerSheet: 1000000, // Excel最大行数限制
	}
}

// ExportToExcelAdvanced 高级Excel导出功能
func (es *ExcelService) ExportToExcelAdvanced(data *QueryResult, options *ExportOptions) (string, error) {
	if options == nil {
		options = DefaultExportOptions()
	}

	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("关闭Excel文件失败: %v", err)
		}
	}()

	// 删除默认工作表
	f.DeleteSheet("Sheet1")

	// 计算需要的工作表数量
	totalRows := len(data.Rows)
	if options.IncludeHeader {
		totalRows++
	}
	numSheets := (totalRows + options.MaxRowsPerSheet - 1) / options.MaxRowsPerSheet
	if numSheets == 0 {
		numSheets = 1
	}

	// 创建样式
	headerStyleID := 0
	dataStyleID := 0
	var err error

	if options.HeaderStyle != nil {
		headerStyleID, err = f.NewStyle(options.HeaderStyle)
		if err != nil {
			log.Printf("创建表头样式失败: %v", err)
		}
	}

	if options.DataStyle != nil {
		dataStyleID, err = f.NewStyle(options.DataStyle)
		if err != nil {
			log.Printf("创建数据样式失败: %v", err)
		}
	}

	// 处理每个工作表
	for sheetIndex := 0; sheetIndex < numSheets; sheetIndex++ {
		sheetName := options.SheetName
		if numSheets > 1 {
			sheetName = fmt.Sprintf("%s_%d", options.SheetName, sheetIndex+1)
		}

		// 创建工作表
		index, err := f.NewSheet(sheetName)
		if err != nil {
			return "", fmt.Errorf("创建工作表失败: %v", err)
		}

		// 设置为活动工作表
		if sheetIndex == 0 {
			f.SetActiveSheet(index)
		}

		currentRow := 1

		// 写入表头（仅在第一个工作表或每个工作表都包含表头时）
		if options.IncludeHeader && (sheetIndex == 0 || numSheets > 1) {
			for colIndex, column := range data.Columns {
				cell, _ := excelize.CoordinatesToCellName(colIndex+1, currentRow)
				f.SetCellValue(sheetName, cell, column)
				if headerStyleID > 0 {
					f.SetCellStyle(sheetName, cell, cell, headerStyleID)
				}
			}
			currentRow++
		}

		// 计算当前工作表的数据范围
		startRowIndex := sheetIndex * options.MaxRowsPerSheet
		if options.IncludeHeader && sheetIndex > 0 {
			startRowIndex -= sheetIndex // 减去之前工作表的表头行数
		}
		endRowIndex := startRowIndex + options.MaxRowsPerSheet
		if endRowIndex > len(data.Rows) {
			endRowIndex = len(data.Rows)
		}

		// 写入数据行
		for rowIndex := startRowIndex; rowIndex < endRowIndex; rowIndex++ {
			if rowIndex >= len(data.Rows) {
				break
			}

			row := data.Rows[rowIndex]
			for colIndex, cellValue := range row {
				cell, _ := excelize.CoordinatesToCellName(colIndex+1, currentRow)

				// 智能类型转换
				if cellValue == nil {
					f.SetCellValue(sheetName, cell, "")
				} else {
					// 尝试转换为数字
					if str, ok := cellValue.(string); ok {
						if num, err := strconv.ParseFloat(str, 64); err == nil {
							f.SetCellValue(sheetName, cell, num)
						} else {
							f.SetCellValue(sheetName, cell, str)
						}
					} else {
						f.SetCellValue(sheetName, cell, cellValue)
					}
				}

				// 应用数据样式
				if dataStyleID > 0 {
					f.SetCellStyle(sheetName, cell, cell, dataStyleID)
				}
			}
			currentRow++
		}

		// 自动调整列宽
		if options.AutoWidth {
			for colIndex := range data.Columns {
				colName, _ := excelize.ColumnNumberToName(colIndex + 1)
				// 设置合理的列宽（8-50字符）
				width := es.calculateColumnWidth(data, colIndex)
				f.SetColWidth(sheetName, colName, colName, width)
			}
		}
	}

	// 生成文件路径
	filePath, err := es.generateExportFilePath()
	if err != nil {
		return "", err
	}

	// 保存文件
	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("保存Excel文件失败: %v", err)
	}

	log.Printf("Excel文件导出成功: %s, 工作表数量: %d, 总行数: %d", filePath, numSheets, len(data.Rows))
	return filePath, nil
}

// calculateColumnWidth 计算列宽
func (es *ExcelService) calculateColumnWidth(data *QueryResult, colIndex int) float64 {
	maxWidth := 8.0  // 最小宽度
	maxLimit := 50.0 // 最大宽度

	// 检查列标题长度
	if colIndex < len(data.Columns) {
		headerLen := float64(len(data.Columns[colIndex]))
		if headerLen > maxWidth {
			maxWidth = headerLen
		}
	}

	// 检查前100行数据的长度
	sampleSize := 100
	if len(data.Rows) < sampleSize {
		sampleSize = len(data.Rows)
	}

	for i := 0; i < sampleSize; i++ {
		if colIndex < len(data.Rows[i]) && data.Rows[i][colIndex] != nil {
			cellStr := fmt.Sprintf("%v", data.Rows[i][colIndex])
			cellLen := float64(len(cellStr))
			if cellLen > maxWidth {
				maxWidth = cellLen
			}
		}
	}

	// 限制最大宽度
	if maxWidth > maxLimit {
		maxWidth = maxLimit
	}

	return maxWidth
}

// generateExportFilePath 生成导出文件路径
func (es *ExcelService) generateExportFilePath() (string, error) {
	// 获取用户下载目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("获取用户主目录失败: %v", err)
	}
	downloadsDir := filepath.Join(homeDir, "Downloads")

	// 确保下载目录存在
	if err := os.MkdirAll(downloadsDir, os.FileMode(es.config.System.FilePermissions)); err != nil {
		return "", fmt.Errorf("创建下载目录失败: %v", err)
	}

	// 生成文件名（包含时间戳）
	timestamp := time.Now().Format(es.config.Export.TimestampFormat)
	filename := fmt.Sprintf(es.config.Export.FilenameTemplate, timestamp)
	filePath := filepath.Join(downloadsDir, filename)

	return filePath, nil
}

// ValidateExcelFile 验证Excel文件
func (es *ExcelService) ValidateExcelFile(filePath string) error {
	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("文件不存在: %s", filePath)
	}

	// 检查文件大小
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("获取文件信息失败: %v", err)
	}

	maxSize := int64(es.config.FileHandling.Upload.MaxFileSizeMB) * 1024 * 1024
	if fileInfo.Size() > maxSize {
		return fmt.Errorf("文件大小超过限制: %d MB", es.config.FileHandling.Upload.MaxFileSizeMB)
	}

	// 尝试打开Excel文件
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return fmt.Errorf("无效的Excel文件: %v", err)
	}
	defer f.Close()

	// 检查是否有工作表
	sheetList := f.GetSheetList()
	if len(sheetList) == 0 {
		return fmt.Errorf("Excel文件中没有工作表")
	}

	return nil
}

// GetExcelInfo 获取Excel文件信息
func (es *ExcelService) GetExcelInfo(filePath string) (*ExcelFileInfo, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开Excel文件失败: %v", err)
	}
	defer f.Close()

	info := &ExcelFileInfo{
		FilePath: filePath,
		Sheets:   make([]SheetInfo, 0),
	}

	// 获取所有工作表信息
	sheetList := f.GetSheetList()
	for _, sheetName := range sheetList {
		rows, err := f.GetRows(sheetName)
		if err != nil {
			continue
		}

		sheetInfo := SheetInfo{
			Name:     sheetName,
			RowCount: len(rows),
			ColCount: 0,
		}

		// 计算最大列数
		for _, row := range rows {
			if len(row) > sheetInfo.ColCount {
				sheetInfo.ColCount = len(row)
			}
		}

		info.Sheets = append(info.Sheets, sheetInfo)
	}

	return info, nil
}

// ExcelFileInfo Excel文件信息
type ExcelFileInfo struct {
	FilePath string      `json:"file_path"`
	Sheets   []SheetInfo `json:"sheets"`
}

// SheetInfo 工作表信息
type SheetInfo struct {
	Name     string `json:"name"`
	RowCount int    `json:"row_count"`
	ColCount int    `json:"col_count"`
}