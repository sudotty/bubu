package data

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	pdf "github.com/ledongthuc/pdf"
)

const maximumKnowledgeSourceBytes = 20 * 1024 * 1024
const maximumKnowledgeTextBytes = 8 * 1024 * 1024

func extractKnowledgeText(ctx context.Context, sourcePath string) (kind string, raw []byte, text string, err error) {
	if strings.TrimSpace(sourcePath) == "" {
		return "", nil, "", errors.New("knowledge source path is required")
	}
	raw, err = os.ReadFile(sourcePath)
	if err != nil {
		return "", nil, "", err
	}
	if len(raw) < 1 || len(raw) > maximumKnowledgeSourceBytes {
		return "", nil, "", errors.New("knowledge source must contain between 1 byte and 20 MiB")
	}
	if err := ctx.Err(); err != nil {
		return "", nil, "", err
	}
	switch strings.ToLower(filepath.Ext(sourcePath)) {
	case ".txt":
		kind, text = "text", string(raw)
	case ".md", ".markdown":
		kind, text = "markdown", string(raw)
	case ".pdf":
		kind = "pdf"
		file, reader, openErr := pdf.Open(sourcePath)
		if openErr != nil {
			return "", nil, "", errors.New("PDF text could not be extracted")
		}
		defer file.Close()
		plain, plainErr := reader.GetPlainText()
		if plainErr != nil {
			return "", nil, "", errors.New("PDF has no readable text layer")
		}
		var output bytes.Buffer
		if _, copyErr := io.CopyN(&output, plain, maximumKnowledgeTextBytes+1); copyErr != nil && !errors.Is(copyErr, io.EOF) {
			return "", nil, "", errors.New("PDF text extraction failed")
		}
		text = output.String()
	default:
		return "", nil, "", errors.New("knowledge source must be TXT, Markdown, or PDF")
	}
	if !utf8.ValidString(text) {
		return "", nil, "", errors.New("knowledge source text must be valid UTF-8")
	}
	text = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n"))
	if text == "" || len([]byte(text)) > maximumKnowledgeTextBytes {
		return "", nil, "", errors.New("knowledge source has no bounded readable text")
	}
	return kind, raw, text, nil
}
