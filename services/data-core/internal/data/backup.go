package data

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	backupFormatVersion = 1
	backupExtension     = ".bubu-backup"
	backupManifestName  = "manifest.json"
	backupDatabaseName  = "bubu.db"
	maximumManifestSize = 64 * 1024
	maximumRestoreBytes = int64(64 * 1024 * 1024 * 1024)
)

func (service *Service) CreateBackup(
	ctx context.Context,
	targetPath string,
) (DataBackupResult, error) {
	absolutePath, err := validateBackupPath(targetPath, false)
	if err != nil {
		return DataBackupResult{}, err
	}
	snapshotPath, err := vacantTemporaryPath(filepath.Dir(absolutePath), ".bubu-snapshot-*.db")
	if err != nil {
		return DataBackupResult{}, err
	}
	defer os.Remove(snapshotPath)
	if _, err := service.database.ExecContext(ctx, "VACUUM main INTO ?", snapshotPath); err != nil {
		return DataBackupResult{}, fmt.Errorf("create consistent database snapshot: %w", err)
	}
	if err := os.Chmod(snapshotPath, 0o600); err != nil {
		return DataBackupResult{}, fmt.Errorf("restrict database snapshot: %w", err)
	}
	manifest, err := buildBackupManifest(ctx, snapshotPath)
	if err != nil {
		return DataBackupResult{}, err
	}
	if err := writeBackupArchive(ctx, absolutePath, snapshotPath, manifest); err != nil {
		return DataBackupResult{}, err
	}
	return DataBackupResult{
		Status: "created", FileName: filepath.Base(absolutePath),
		BackupCreatedAt: manifest.BackupCreatedAt, DatabaseBytes: manifest.DatabaseBytes,
		DatasetCount: manifest.DatasetCount, GroupCount: manifest.GroupCount,
	}, nil
}

func buildBackupManifest(
	ctx context.Context,
	snapshotPath string,
) (backupManifest, error) {
	database, err := openReadOnlyBackupDatabase(snapshotPath)
	if err != nil {
		return backupManifest{}, err
	}
	defer database.Close()
	var schemaVersion int
	if err := database.QueryRowContext(ctx, "SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&schemaVersion); err != nil {
		return backupManifest{}, fmt.Errorf("read backup schema version: %w", err)
	}
	var datasetCount, groupCount int64
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM datasets").Scan(&datasetCount); err != nil {
		return backupManifest{}, fmt.Errorf("count backup datasets: %w", err)
	}
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM dataset_groups").Scan(&groupCount); err != nil {
		return backupManifest{}, fmt.Errorf("count backup groups: %w", err)
	}
	digest, size, err := hashBackupFile(ctx, snapshotPath)
	if err != nil {
		return backupManifest{}, err
	}
	return backupManifest{
		FormatVersion: backupFormatVersion, Product: "bubu",
		BackupCreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
		DatabaseSHA256:  digest, DatabaseBytes: size, SchemaVersion: schemaVersion,
		DatasetCount: datasetCount, GroupCount: groupCount,
	}, nil
}

func writeBackupArchive(
	ctx context.Context,
	targetPath string,
	snapshotPath string,
	manifest backupManifest,
) error {
	temporary, err := os.CreateTemp(filepath.Dir(targetPath), ".bubu-backup-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary backup archive: %w", err)
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		if !committed {
			temporary.Close()
			os.Remove(temporaryPath)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("restrict temporary backup archive: %w", err)
	}
	archive := zip.NewWriter(temporary)
	manifestEntry, err := archive.CreateHeader(zipHeader(backupManifestName, zip.Store))
	if err != nil {
		return fmt.Errorf("create backup manifest entry: %w", err)
	}
	if err := json.NewEncoder(manifestEntry).Encode(manifest); err != nil {
		return fmt.Errorf("write backup manifest: %w", err)
	}
	databaseEntry, err := archive.CreateHeader(zipHeader(backupDatabaseName, zip.Deflate))
	if err != nil {
		return fmt.Errorf("create backup database entry: %w", err)
	}
	snapshot, err := os.Open(snapshotPath)
	if err != nil {
		return fmt.Errorf("open database snapshot: %w", err)
	}
	if _, err := copyWithContext(ctx, databaseEntry, snapshot); err != nil {
		snapshot.Close()
		return fmt.Errorf("write database snapshot: %w", err)
	}
	if err := snapshot.Close(); err != nil {
		return fmt.Errorf("close database snapshot: %w", err)
	}
	if err := archive.Close(); err != nil {
		return fmt.Errorf("finish backup archive: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("sync backup archive: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close backup archive: %w", err)
	}
	if err := replaceFileAtomically(temporaryPath, targetPath); err != nil {
		return fmt.Errorf("publish backup archive: %w", err)
	}
	committed = true
	return os.Chmod(targetPath, 0o600)
}

func zipHeader(name string, method uint16) *zip.FileHeader {
	header := &zip.FileHeader{Name: name, Method: method}
	header.SetMode(0o600)
	header.SetModTime(time.Unix(0, 0).UTC())
	return header
}

func hashBackupFile(ctx context.Context, path string) (string, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", 0, fmt.Errorf("open file for hashing: %w", err)
	}
	defer file.Close()
	hash := sha256.New()
	size, err := copyWithContext(ctx, hash, file)
	if err != nil {
		return "", 0, fmt.Errorf("hash database snapshot: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), size, nil
}

func copyWithContext(ctx context.Context, destination io.Writer, source io.Reader) (int64, error) {
	buffer := make([]byte, 256*1024)
	var written int64
	for {
		if err := ctx.Err(); err != nil {
			return written, err
		}
		count, readErr := source.Read(buffer)
		if count > 0 {
			outputCount, writeErr := destination.Write(buffer[:count])
			written += int64(outputCount)
			if writeErr != nil {
				return written, writeErr
			}
			if outputCount != count {
				return written, io.ErrShortWrite
			}
		}
		if errors.Is(readErr, io.EOF) {
			return written, nil
		}
		if readErr != nil {
			return written, readErr
		}
	}
}

func validateBackupPath(path string, mustExist bool) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New("backup path is required")
	}
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("resolve backup path: %w", err)
	}
	if strings.ToLower(filepath.Ext(absolutePath)) != backupExtension {
		return "", fmt.Errorf("backup file must use the %s extension", backupExtension)
	}
	if mustExist {
		info, err := os.Stat(absolutePath)
		if err != nil {
			return "", fmt.Errorf("inspect backup file: %w", err)
		}
		if !info.Mode().IsRegular() {
			return "", errors.New("backup source is not a regular file")
		}
		return absolutePath, nil
	}
	info, err := os.Stat(filepath.Dir(absolutePath))
	if err != nil {
		return "", fmt.Errorf("inspect backup directory: %w", err)
	}
	if !info.IsDir() {
		return "", errors.New("backup destination is not a directory")
	}
	return absolutePath, nil
}

func vacantTemporaryPath(directory string, pattern string) (string, error) {
	file, err := os.CreateTemp(directory, pattern)
	if err != nil {
		return "", fmt.Errorf("reserve temporary database path: %w", err)
	}
	path := file.Name()
	if err := file.Close(); err != nil {
		os.Remove(path)
		return "", fmt.Errorf("close temporary database placeholder: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return "", fmt.Errorf("vacate temporary database path: %w", err)
	}
	return path, nil
}
