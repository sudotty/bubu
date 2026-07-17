package data

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type preparedSource struct {
	source *tabularSource
	hash   string
	size   int64
	closed bool
}

func prepareSource(sourcePath string) (*preparedSource, error) {
	absolutePath, err := filepath.Abs(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("resolve source path: %w", err)
	}
	info, err := os.Stat(absolutePath)
	if err != nil {
		return nil, fmt.Errorf("inspect source file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("source must be a regular file")
	}
	hash, err := hashFile(absolutePath)
	if err != nil {
		return nil, err
	}
	source, err := openTabularSource(absolutePath)
	if err != nil {
		return nil, err
	}
	if len(source.tables) == 0 {
		_ = source.close()
		return nil, errors.New("source contains no non-empty tables")
	}
	return &preparedSource{source: source, hash: hash, size: info.Size()}, nil
}

func (prepared *preparedSource) close() error {
	if prepared.closed {
		return nil
	}
	prepared.closed = true
	return prepared.source.close()
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open source for hashing: %w", err)
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("hash source file: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
