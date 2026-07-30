package data

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

func (book *xlsxWorkbook) walkRows(ctx context.Context, sheet xlsxSheet, yield func([]string) error) error {
	file, err := book.requiredPart(sheet.partName, maximumXLSXWorksheetBytes)
	if err != nil {
		return fmt.Errorf("open worksheet %q: %w", sheet.name, err)
	}
	reader, err := file.Open()
	if err != nil {
		return fmt.Errorf("open worksheet %q: %w", sheet.name, err)
	}
	defer reader.Close()
	decoder := xml.NewDecoder(reader)
	rowNumber := 0
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("decode worksheet %q: %w", sheet.name, err)
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "row" {
			continue
		}
		rowNumber++
		row, err := book.decodeRow(decoder, start)
		if err != nil {
			return fmt.Errorf("read worksheet %q row %d: %w", sheet.name, rowNumber, err)
		}
		if err := yield(row); err != nil {
			return err
		}
	}
}

func (book *xlsxWorkbook) decodeRow(decoder *xml.Decoder, rowStart xml.StartElement) ([]string, error) {
	row := make([]string, 0)
	nextColumn := 0
	for {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		switch current := token.(type) {
		case xml.StartElement:
			if current.Name.Local != "c" {
				continue
			}
			reference := ""
			cellType := ""
			for _, attribute := range current.Attr {
				switch attribute.Name.Local {
				case "r":
					reference = attribute.Value
				case "t":
					cellType = attribute.Value
				}
			}
			column := nextColumn
			if reference != "" {
				column, err = xlsxColumnIndex(reference)
				if err != nil {
					return nil, err
				}
			}
			if column >= maximumDatasetColumns {
				return nil, fmt.Errorf("cell %q exceeds the %d-column product limit", reference, maximumDatasetColumns)
			}
			if column < nextColumn {
				return nil, fmt.Errorf("cell %q is duplicated or out of order", reference)
			}
			value, err := book.decodeCell(decoder, current, cellType)
			if err != nil {
				return nil, fmt.Errorf("cell %q: %w", reference, err)
			}
			for len(row) <= column {
				row = append(row, "")
			}
			row[column] = value
			nextColumn = column + 1
		case xml.EndElement:
			if current.Name == rowStart.Name {
				return row, nil
			}
		}
	}
}

func (book *xlsxWorkbook) decodeCell(decoder *xml.Decoder, cellStart xml.StartElement, cellType string) (string, error) {
	value := ""
	inlineText := strings.Builder{}
	for {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		switch current := token.(type) {
		case xml.StartElement:
			switch current.Name.Local {
			case "v":
				value, err = decodeBoundedXLSXText(decoder, current)
				if err != nil {
					return "", err
				}
			case "is":
				fragment, err := decodeXLSXTextContainer(decoder, current)
				if err != nil {
					return "", err
				}
				if inlineText.Len()+len(fragment) > maximumXLSXCellBytes {
					return "", fmt.Errorf("inline text exceeds %d bytes", maximumXLSXCellBytes)
				}
				inlineText.WriteString(fragment)
			case "t":
				fragment, err := decodeBoundedXLSXText(decoder, current)
				if err != nil {
					return "", err
				}
				if inlineText.Len()+len(fragment) > maximumXLSXCellBytes {
					return "", fmt.Errorf("inline text exceeds %d bytes", maximumXLSXCellBytes)
				}
				inlineText.WriteString(fragment)
			}
		case xml.EndElement:
			if current.Name == cellStart.Name {
				if len(value) > maximumXLSXCellBytes {
					return "", fmt.Errorf("value exceeds %d bytes", maximumXLSXCellBytes)
				}
				switch cellType {
				case "s":
					index, err := strconv.Atoi(strings.TrimSpace(value))
					if err != nil || index < 0 || index >= len(book.sharedStrings) {
						return "", fmt.Errorf("shared-string index %q is invalid", value)
					}
					return book.sharedStrings[index], nil
				case "inlineStr":
					return inlineText.String(), nil
				case "", "n", "str", "d", "e":
					return value, nil
				case "b":
					if value != "0" && value != "1" {
						return "", fmt.Errorf("Boolean value %q is invalid", value)
					}
					return value, nil
				default:
					return "", fmt.Errorf("cell type %q is unsupported", cellType)
				}
			}
		}
	}
}

func decodeXLSXTextContainer(decoder *xml.Decoder, container xml.StartElement) (string, error) {
	result := strings.Builder{}
	for {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		switch current := token.(type) {
		case xml.StartElement:
			if current.Name.Local == "rPh" {
				if err := decoder.Skip(); err != nil {
					return "", err
				}
				continue
			}
			if current.Name.Local != "t" {
				continue
			}
			fragment, err := decodeBoundedXLSXText(decoder, current)
			if err != nil {
				return "", err
			}
			if result.Len()+len(fragment) > maximumXLSXCellBytes {
				return "", fmt.Errorf("text exceeds %d bytes", maximumXLSXCellBytes)
			}
			result.WriteString(fragment)
		case xml.EndElement:
			if current.Name == container.Name {
				return result.String(), nil
			}
		}
	}
}

func decodeBoundedXLSXText(decoder *xml.Decoder, _ xml.StartElement) (string, error) {
	result := strings.Builder{}
	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		switch current := token.(type) {
		case xml.StartElement:
			depth++
		case xml.EndElement:
			depth--
		case xml.CharData:
			if result.Len()+len(current) > maximumXLSXCellBytes {
				return "", fmt.Errorf("text exceeds %d bytes", maximumXLSXCellBytes)
			}
			result.Write(current)
		}
	}
	return result.String(), nil
}

func xlsxColumnIndex(reference string) (int, error) {
	original := reference
	if strings.HasPrefix(reference, "$") {
		reference = reference[1:]
	}
	column := 0
	letters := 0
	for len(reference) > 0 {
		current := reference[0]
		if current >= 'a' && current <= 'z' {
			current -= 'a' - 'A'
		}
		if current < 'A' || current > 'Z' {
			break
		}
		letters++
		column = column*26 + int(current-'A') + 1
		reference = reference[1:]
	}
	if strings.HasPrefix(reference, "$") {
		reference = reference[1:]
	}
	if letters == 0 || column == 0 || column > 16_384 || reference == "" {
		return 0, fmt.Errorf("cell reference %q is invalid", original)
	}
	row, err := strconv.Atoi(reference)
	if err != nil || row < 1 || row > 1_048_576 {
		return 0, fmt.Errorf("cell reference %q is invalid", original)
	}
	return column - 1, nil
}
