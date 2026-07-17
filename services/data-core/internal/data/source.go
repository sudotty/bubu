package data

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/xuri/excelize/v2"
)

type sourceTable struct {
	displayName string
	sheetName   string
	header      []string
	walkRows    func(context.Context, func([]string) error) error
}

type tabularSource struct {
	kind   string
	name   string
	tables []sourceTable
	close  func() error
}

func openTabularSource(path string) (*tabularSource, error) {
	extension := strings.ToLower(filepath.Ext(path))
	switch extension {
	case ".csv", ".tsv":
		return openCSVSource(path)
	case ".xlsx":
		return openWorkbookSource(path)
	default:
		return nil, fmt.Errorf("unsupported tabular file extension: %s", extension)
	}
}

func openCSVSource(path string) (*tabularSource, error) {
	delimiter, err := detectDelimiter(path)
	if err != nil {
		return nil, err
	}
	header, err := readCSVHeader(path, delimiter)
	if err != nil {
		return nil, err
	}
	baseName := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	table := sourceTable{
		displayName: baseName,
		header:      header,
		walkRows: func(ctx context.Context, yield func([]string) error) error {
			file, err := os.Open(path)
			if err != nil {
				return fmt.Errorf("open CSV: %w", err)
			}
			defer file.Close()
			reader := newCSVReader(file, delimiter)
			if _, err := reader.Read(); err != nil {
				return fmt.Errorf("read CSV header: %w", err)
			}
			for rowNumber := 2; ; rowNumber++ {
				if err := ctx.Err(); err != nil {
					return err
				}
				row, err := reader.Read()
				if errors.Is(err, io.EOF) {
					return nil
				}
				if err != nil {
					return fmt.Errorf("read CSV row %d: %w", rowNumber, err)
				}
				if err := yield(row); err != nil {
					return fmt.Errorf("import CSV row %d: %w", rowNumber, err)
				}
			}
		},
	}
	return &tabularSource{kind: "csv", name: filepath.Base(path), tables: []sourceTable{table}, close: func() error { return nil }}, nil
}

func detectDelimiter(path string) (rune, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, fmt.Errorf("open CSV sample: %w", err)
	}
	defer file.Close()
	contents, err := io.ReadAll(io.LimitReader(file, 64*1024))
	if err != nil {
		return 0, fmt.Errorf("read CSV sample: %w", err)
	}
	bestDelimiter := ','
	bestFields := 1
	for _, delimiter := range []rune{',', '\t', ';'} {
		reader := newCSVReader(bytes.NewReader(contents), delimiter)
		record, readErr := reader.Read()
		if readErr == nil && len(record) > bestFields {
			bestFields = len(record)
			bestDelimiter = delimiter
		}
	}
	return bestDelimiter, nil
}

func newCSVReader(reader io.Reader, delimiter rune) *csv.Reader {
	result := csv.NewReader(reader)
	result.Comma = delimiter
	result.FieldsPerRecord = -1
	result.TrimLeadingSpace = false
	result.ReuseRecord = false
	return result
}

func readCSVHeader(path string, delimiter rune) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open CSV: %w", err)
	}
	defer file.Close()
	header, err := newCSVReader(file, delimiter).Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}
	if len(header) == 0 {
		return nil, errors.New("CSV header is empty")
	}
	header[0] = strings.TrimPrefix(header[0], "\ufeff")
	return header, nil
}

func openWorkbookSource(path string) (*tabularSource, error) {
	book, err := excelize.OpenFile(path, excelize.Options{RawCellValue: true})
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	baseName := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	tables := make([]sourceTable, 0, len(book.GetSheetList()))
	for _, sheetName := range book.GetSheetList() {
		header, err := workbookHeader(book, sheetName)
		if err != nil {
			book.Close()
			return nil, err
		}
		if len(header) == 0 {
			continue
		}
		currentSheet := sheetName
		tables = append(tables, sourceTable{
			displayName: baseName + " · " + sheetName,
			sheetName:   sheetName,
			header:      header,
			walkRows: func(ctx context.Context, yield func([]string) error) error {
				rows, err := book.Rows(currentSheet)
				if err != nil {
					return fmt.Errorf("open worksheet %q: %w", currentSheet, err)
				}
				defer rows.Close()
				headerSeen := false
				rowNumber := 0
				for rows.Next() {
					rowNumber++
					if err := ctx.Err(); err != nil {
						return err
					}
					columns, err := rows.Columns(excelize.Options{RawCellValue: true})
					if err != nil {
						return fmt.Errorf("read worksheet %q row %d: %w", currentSheet, rowNumber, err)
					}
					if !headerSeen {
						if rowHasValue(columns) {
							headerSeen = true
						}
						continue
					}
					if err := yield(columns); err != nil {
						return fmt.Errorf("import worksheet %q row %d: %w", currentSheet, rowNumber, err)
					}
				}
				if err := rows.Error(); err != nil {
					return fmt.Errorf("iterate worksheet %q: %w", currentSheet, err)
				}
				return nil
			},
		})
	}
	return &tabularSource{kind: "xlsx", name: filepath.Base(path), tables: tables, close: book.Close}, nil
}

func workbookHeader(book *excelize.File, sheetName string) ([]string, error) {
	rows, err := book.Rows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("open worksheet %q: %w", sheetName, err)
	}
	defer rows.Close()
	for rows.Next() {
		columns, err := rows.Columns(excelize.Options{RawCellValue: true})
		if err != nil {
			return nil, fmt.Errorf("read worksheet %q header: %w", sheetName, err)
		}
		if rowHasValue(columns) {
			return columns, nil
		}
	}
	if err := rows.Error(); err != nil {
		return nil, fmt.Errorf("iterate worksheet %q: %w", sheetName, err)
	}
	return nil, nil
}

func rowHasValue(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}
