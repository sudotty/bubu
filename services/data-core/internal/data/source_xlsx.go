package data

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"
)

const (
	maximumXLSXEntries            = 10_000
	maximumXLSXExpandedBytes      = uint64(4 * 1024 * 1024 * 1024)
	maximumXLSXMetadataBytes      = uint64(16 * 1024 * 1024)
	maximumXLSXSharedStringsBytes = uint64(256 * 1024 * 1024)
	maximumXLSXWorksheetBytes     = uint64(2 * 1024 * 1024 * 1024)
	maximumXLSXCellBytes          = 1024 * 1024
	maximumXLSXSharedStrings      = 1_000_000
	maximumXLSXSheets             = 1_000
)

type xlsxWorkbook struct {
	archive       *zip.ReadCloser
	files         map[string]*zip.File
	sharedStrings []string
	sheets        []xlsxSheet
}

type xlsxSheet struct {
	name     string
	partName string
}

type xlsxRelationship struct {
	id       string
	target   string
	kind     string
	external bool
}

func openXLSXWorkbook(filePath string) (*xlsxWorkbook, error) {
	archive, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, fmt.Errorf("read XLSX package: %w", err)
	}
	book := &xlsxWorkbook{archive: archive, files: make(map[string]*zip.File, len(archive.File))}
	closeWithError := func(err error) (*xlsxWorkbook, error) {
		_ = archive.Close()
		return nil, err
	}
	if len(archive.File) > maximumXLSXEntries {
		return closeWithError(fmt.Errorf("XLSX package has %d entries; maximum is %d", len(archive.File), maximumXLSXEntries))
	}
	var expandedBytes uint64
	for _, file := range archive.File {
		name := strings.TrimPrefix(file.Name, "/")
		if file.FileInfo().IsDir() {
			continue
		}
		if name == "" || path.Clean(name) != name || strings.HasPrefix(name, "../") || strings.Contains(name, "\\") {
			return closeWithError(fmt.Errorf("XLSX package contains an invalid part name %q", file.Name))
		}
		if file.Flags&1 != 0 {
			return closeWithError(fmt.Errorf("encrypted XLSX part %q is not supported", name))
		}
		if _, exists := book.files[name]; exists {
			return closeWithError(fmt.Errorf("XLSX package contains duplicate part %q", name))
		}
		if maximumXLSXExpandedBytes-expandedBytes < file.UncompressedSize64 {
			return closeWithError(fmt.Errorf("XLSX package expands beyond %d bytes", maximumXLSXExpandedBytes))
		}
		expandedBytes += file.UncompressedSize64
		book.files[name] = file
	}

	workbookPart, err := book.requiredPart("xl/workbook.xml", maximumXLSXMetadataBytes)
	if err != nil {
		return closeWithError(err)
	}
	relationshipPart, err := book.requiredPart("xl/_rels/workbook.xml.rels", maximumXLSXMetadataBytes)
	if err != nil {
		return closeWithError(err)
	}
	relationships, err := parseXLSXRelationships(relationshipPart)
	if err != nil {
		return closeWithError(fmt.Errorf("parse workbook relationships: %w", err))
	}
	book.sharedStrings, err = book.loadSharedStrings(relationships)
	if err != nil {
		return closeWithError(err)
	}
	book.sheets, err = book.loadSheets(workbookPart, relationships)
	if err != nil {
		return closeWithError(err)
	}
	return book, nil
}

func (book *xlsxWorkbook) Close() error {
	return book.archive.Close()
}

func (book *xlsxWorkbook) requiredPart(name string, maximumBytes uint64) (*zip.File, error) {
	file := book.files[name]
	if file == nil {
		return nil, fmt.Errorf("XLSX package is missing %q", name)
	}
	if file.UncompressedSize64 > maximumBytes {
		return nil, fmt.Errorf("XLSX part %q is %d bytes; maximum is %d", name, file.UncompressedSize64, maximumBytes)
	}
	return file, nil
}

func parseXLSXRelationships(file *zip.File) (map[string]xlsxRelationship, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	decoder := xml.NewDecoder(reader)
	result := map[string]xlsxRelationship{}
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			return nil, err
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "Relationship" {
			continue
		}
		relationship := xlsxRelationship{}
		for _, attribute := range start.Attr {
			switch attribute.Name.Local {
			case "Id":
				relationship.id = attribute.Value
			case "Target":
				relationship.target = attribute.Value
			case "Type":
				relationship.kind = attribute.Value
			case "TargetMode":
				relationship.external = strings.EqualFold(attribute.Value, "External")
			}
		}
		if relationship.id == "" || relationship.target == "" || relationship.kind == "" {
			return nil, errors.New("workbook relationship is incomplete")
		}
		if _, exists := result[relationship.id]; exists {
			return nil, fmt.Errorf("duplicate workbook relationship %q", relationship.id)
		}
		result[relationship.id] = relationship
	}
}

func (book *xlsxWorkbook) loadSharedStrings(relationships map[string]xlsxRelationship) ([]string, error) {
	sharedStringsPart := ""
	for _, relationship := range relationships {
		if !strings.HasSuffix(relationship.kind, "/sharedStrings") {
			continue
		}
		partName, err := resolveXLSXRelationship("xl/workbook.xml", relationship)
		if err != nil {
			return nil, fmt.Errorf("resolve shared strings: %w", err)
		}
		if sharedStringsPart != "" {
			return nil, errors.New("workbook contains multiple shared-string relationships")
		}
		sharedStringsPart = partName
	}
	if sharedStringsPart == "" {
		return nil, nil
	}
	file, err := book.requiredPart(sharedStringsPart, maximumXLSXSharedStringsBytes)
	if err != nil {
		return nil, err
	}
	return parseXLSXSharedStrings(file)
}

func parseXLSXSharedStrings(file *zip.File) ([]string, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	decoder := xml.NewDecoder(reader)
	stringsTable := make([]string, 0)
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			return stringsTable, nil
		}
		if err != nil {
			return nil, fmt.Errorf("decode shared strings: %w", err)
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "si" {
			continue
		}
		value, err := decodeXLSXTextContainer(decoder, start)
		if err != nil {
			return nil, fmt.Errorf("decode shared string %d: %w", len(stringsTable), err)
		}
		stringsTable = append(stringsTable, value)
		if len(stringsTable) > maximumXLSXSharedStrings {
			return nil, fmt.Errorf("shared-string table exceeds %d entries", maximumXLSXSharedStrings)
		}
	}
}

func (book *xlsxWorkbook) loadSheets(file *zip.File, relationships map[string]xlsxRelationship) ([]xlsxSheet, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	decoder := xml.NewDecoder(reader)
	sheets := make([]xlsxSheet, 0)
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			return sheets, nil
		}
		if err != nil {
			return nil, fmt.Errorf("decode workbook: %w", err)
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "sheet" {
			continue
		}
		name := ""
		relationshipID := ""
		for _, attribute := range start.Attr {
			switch attribute.Name.Local {
			case "name":
				name = strings.TrimSpace(attribute.Value)
			case "id":
				relationshipID = attribute.Value
			}
		}
		if name == "" || relationshipID == "" {
			return nil, errors.New("workbook sheet is missing its name or relationship")
		}
		relationship, exists := relationships[relationshipID]
		if !exists {
			return nil, fmt.Errorf("worksheet %q references unknown relationship %q", name, relationshipID)
		}
		if !strings.HasSuffix(relationship.kind, "/worksheet") {
			continue
		}
		partName, err := resolveXLSXRelationship("xl/workbook.xml", relationship)
		if err != nil {
			return nil, fmt.Errorf("resolve worksheet %q: %w", name, err)
		}
		if _, err := book.requiredPart(partName, maximumXLSXWorksheetBytes); err != nil {
			return nil, err
		}
		sheets = append(sheets, xlsxSheet{name: name, partName: partName})
		if len(sheets) > maximumXLSXSheets {
			return nil, fmt.Errorf("workbook exceeds %d worksheets", maximumXLSXSheets)
		}
	}
}

func resolveXLSXRelationship(owner string, relationship xlsxRelationship) (string, error) {
	if relationship.external {
		return "", errors.New("external workbook relationships are not supported")
	}
	parsed, err := url.Parse(relationship.target)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("invalid package target %q", relationship.target)
	}
	target, err := url.PathUnescape(parsed.EscapedPath())
	if err != nil || target == "" || strings.ContainsRune(target, '\x00') {
		return "", fmt.Errorf("invalid package target %q", relationship.target)
	}
	if strings.HasPrefix(target, "/") {
		target = strings.TrimPrefix(target, "/")
	} else {
		target = path.Join(path.Dir(owner), target)
	}
	target = path.Clean(target)
	if target == "." || target == ".." || strings.HasPrefix(target, "../") {
		return "", fmt.Errorf("package target escapes the archive: %q", relationship.target)
	}
	return target, nil
}
