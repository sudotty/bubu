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
	book, err := openXLSXWorkbook(path)
	if err != nil {
		return nil, fmt.Errorf("open workbook: %w", err)
	}
	baseName := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	tables := make([]sourceTable, 0, len(book.sheets))
	for _, sheet := range book.sheets {
		header, err := workbookHeader(book, sheet)
		if err != nil {
			book.Close()
			return nil, err
		}
		if len(header) == 0 {
			continue
		}
		currentSheet := sheet
		tables = append(tables, sourceTable{
			displayName: baseName + " · " + sheet.name,
			sheetName:   sheet.name,
			header:      header,
			walkRows: func(ctx context.Context, yield func([]string) error) error {
				headerSeen := false
				rowNumber := 0
				return book.walkRows(ctx, currentSheet, func(columns []string) error {
					rowNumber++
					if !headerSeen {
						if rowHasValue(columns) {
							headerSeen = true
						}
						return nil
					}
					if err := yield(columns); err != nil {
						return fmt.Errorf("import worksheet %q row %d: %w", currentSheet.name, rowNumber, err)
					}
					return nil
				})
			},
		})
	}
	return &tabularSource{kind: "xlsx", name: filepath.Base(path), tables: tables, close: book.Close}, nil
}

func workbookHeader(book *xlsxWorkbook, sheet xlsxSheet) ([]string, error) {
	var header []string
	errStop := errors.New("header found")
	err := book.walkRows(context.Background(), sheet, func(columns []string) error {
		if rowHasValue(columns) {
			header = columns
			return errStop
		}
		return nil
	})
	if err != nil && !errors.Is(err, errStop) {
		return nil, err
	}
	return header, nil
}

func rowHasValue(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}
