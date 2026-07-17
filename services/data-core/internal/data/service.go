package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	_ "modernc.org/sqlite"
)

var (
	objectID           = regexp.MustCompile(`^[0-9a-f]{32}$`)
	internalTableName  = regexp.MustCompile(`^data_[0-9a-f]{32}$`)
	physicalColumnName = regexp.MustCompile(`^c[0-9]+$`)
)

type Service struct {
	database     *sql.DB
	databasePath string
}

func Open(dataDirectory string) (*Service, error) {
	if strings.TrimSpace(dataDirectory) == "" {
		return nil, errors.New("data directory is required")
	}
	if err := os.MkdirAll(dataDirectory, 0o700); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}
	databasePath := filepath.Join(dataDirectory, "bubu.db")
	rollbackPath := databasePath + ".restore-rollback"
	if _, err := os.Stat(databasePath); errors.Is(err, os.ErrNotExist) {
		if _, rollbackErr := os.Stat(rollbackPath); rollbackErr == nil {
			if err := os.Rename(rollbackPath, databasePath); err != nil {
				return nil, fmt.Errorf("recover interrupted restore: %w", err)
			}
		}
	}
	database, err := openLocalDatabase(databasePath)
	if err != nil {
		if _, rollbackErr := os.Stat(rollbackPath); rollbackErr != nil {
			return nil, err
		}
		removeDatabaseFiles(databasePath)
		if renameErr := os.Rename(rollbackPath, databasePath); renameErr != nil {
			return nil, fmt.Errorf("restore original database after startup failure: %w (original error: %v)", renameErr, err)
		}
		database, err = openLocalDatabase(databasePath)
		if err != nil {
			return nil, fmt.Errorf("open recovered original database: %w", err)
		}
	}
	_ = os.Remove(rollbackPath)
	return &Service{database: database, databasePath: databasePath}, nil
}

func openLocalDatabase(databasePath string) (*sql.DB, error) {
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		return nil, fmt.Errorf("open SQLite: %w", err)
	}
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	if err := configureDatabase(context.Background(), database); err != nil {
		database.Close()
		return nil, err
	}
	if err := applyMigrations(context.Background(), database); err != nil {
		database.Close()
		return nil, err
	}
	if err := os.Chmod(databasePath, 0o600); err != nil {
		database.Close()
		return nil, fmt.Errorf("restrict database permissions: %w", err)
	}
	return database, nil
}

func configureDatabase(ctx context.Context, database *sql.DB) error {
	for _, statement := range []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
	} {
		if _, err := database.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("configure SQLite with %q: %w", statement, err)
		}
	}
	return nil
}

func (service *Service) Close() error {
	return service.database.Close()
}

func removeDatabaseFiles(databasePath string) {
	_ = os.Remove(databasePath)
	_ = os.Remove(databasePath + "-wal")
	_ = os.Remove(databasePath + "-shm")
}
