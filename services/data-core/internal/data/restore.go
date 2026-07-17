package data

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

func (service *Service) RestoreBackup(
	ctx context.Context,
	sourcePath string,
) (DataRestoreResult, error) {
	absolutePath, err := validateBackupPath(sourcePath, true)
	if err != nil {
		return DataRestoreResult{}, err
	}
	stagedPath, manifest, err := prepareBackupRestore(ctx, absolutePath, filepath.Dir(service.databasePath))
	if err != nil {
		return DataRestoreResult{}, err
	}
	defer os.Remove(stagedPath)
	if err := service.installRestoredDatabase(ctx, stagedPath); err != nil {
		return DataRestoreResult{}, err
	}
	return DataRestoreResult{
		Status: "restored", FileName: filepath.Base(absolutePath),
		BackupCreatedAt: manifest.BackupCreatedAt, DatabaseBytes: manifest.DatabaseBytes,
		DatasetCount: manifest.DatasetCount, GroupCount: manifest.GroupCount,
	}, nil
}

func prepareBackupRestore(
	ctx context.Context,
	archivePath string,
	dataDirectory string,
) (string, backupManifest, error) {
	archive, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", backupManifest{}, fmt.Errorf("open BuBu backup: %w", err)
	}
	defer archive.Close()
	entries, err := strictBackupEntries(archive.File)
	if err != nil {
		return "", backupManifest{}, err
	}
	manifest, err := decodeBackupManifest(entries[backupManifestName])
	if err != nil {
		return "", backupManifest{}, err
	}
	databaseEntry := entries[backupDatabaseName]
	if databaseEntry.UncompressedSize64 != uint64(manifest.DatabaseBytes) {
		return "", backupManifest{}, errors.New("backup database size does not match its manifest")
	}
	staged, err := os.CreateTemp(dataDirectory, ".bubu-restore-*.db")
	if err != nil {
		return "", backupManifest{}, fmt.Errorf("create staged restore database: %w", err)
	}
	stagedPath := staged.Name()
	valid := false
	defer func() {
		if !valid {
			staged.Close()
			os.Remove(stagedPath)
		}
	}()
	if err := staged.Chmod(0o600); err != nil {
		return "", backupManifest{}, fmt.Errorf("restrict staged restore database: %w", err)
	}
	reader, err := databaseEntry.Open()
	if err != nil {
		return "", backupManifest{}, fmt.Errorf("open backup database entry: %w", err)
	}
	hash := sha256.New()
	written, copyErr := copyWithContext(ctx, io.MultiWriter(staged, hash), reader)
	closeErr := reader.Close()
	if copyErr != nil {
		return "", backupManifest{}, fmt.Errorf("extract backup database: %w", copyErr)
	}
	if closeErr != nil {
		return "", backupManifest{}, fmt.Errorf("finish backup database extraction: %w", closeErr)
	}
	if written != manifest.DatabaseBytes || hex.EncodeToString(hash.Sum(nil)) != manifest.DatabaseSHA256 {
		return "", backupManifest{}, errors.New("backup database digest does not match its manifest")
	}
	if err := staged.Sync(); err != nil {
		return "", backupManifest{}, fmt.Errorf("sync staged restore database: %w", err)
	}
	if err := staged.Close(); err != nil {
		return "", backupManifest{}, fmt.Errorf("close staged restore database: %w", err)
	}
	if err := validateBackupDatabase(ctx, stagedPath, manifest); err != nil {
		return "", backupManifest{}, err
	}
	valid = true
	return stagedPath, manifest, nil
}

func strictBackupEntries(files []*zip.File) (map[string]*zip.File, error) {
	if len(files) != 2 {
		return nil, errors.New("BuBu backup must contain exactly a manifest and database")
	}
	entries := make(map[string]*zip.File, len(files))
	for _, file := range files {
		if file.Name != backupManifestName && file.Name != backupDatabaseName {
			return nil, fmt.Errorf("BuBu backup contains an unexpected entry: %s", file.Name)
		}
		if !file.FileInfo().Mode().IsRegular() || entries[file.Name] != nil {
			return nil, errors.New("BuBu backup contains a duplicate or non-regular entry")
		}
		entries[file.Name] = file
	}
	if entries[backupManifestName] == nil || entries[backupDatabaseName] == nil {
		return nil, errors.New("BuBu backup is missing its manifest or database")
	}
	return entries, nil
}

func decodeBackupManifest(entry *zip.File) (backupManifest, error) {
	if entry.UncompressedSize64 > maximumManifestSize {
		return backupManifest{}, errors.New("backup manifest is too large")
	}
	reader, err := entry.Open()
	if err != nil {
		return backupManifest{}, fmt.Errorf("open backup manifest: %w", err)
	}
	defer reader.Close()
	raw, err := io.ReadAll(io.LimitReader(reader, maximumManifestSize+1))
	if err != nil {
		return backupManifest{}, fmt.Errorf("read backup manifest: %w", err)
	}
	if len(raw) > maximumManifestSize {
		return backupManifest{}, errors.New("backup manifest is too large")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var manifest backupManifest
	if err := decoder.Decode(&manifest); err != nil {
		return backupManifest{}, fmt.Errorf("decode backup manifest: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return backupManifest{}, errors.New("backup manifest contains trailing data")
	}
	if manifest.FormatVersion != backupFormatVersion || manifest.Product != "bubu" {
		return backupManifest{}, errors.New("backup format or product is unsupported")
	}
	if _, err := time.Parse(time.RFC3339Nano, manifest.BackupCreatedAt); err != nil {
		return backupManifest{}, errors.New("backup creation time is invalid")
	}
	if !validBackupDigest(manifest.DatabaseSHA256) || manifest.DatabaseBytes <= 0 || manifest.DatabaseBytes > maximumRestoreBytes {
		return backupManifest{}, errors.New("backup database size or digest is invalid")
	}
	if manifest.DatasetCount < 0 || manifest.GroupCount < 0 || manifest.SchemaVersion < 1 || manifest.SchemaVersion > len(migrations) {
		return backupManifest{}, errors.New("backup schema version or catalog counts are invalid")
	}
	return manifest, nil
}

func (service *Service) installRestoredDatabase(ctx context.Context, stagedPath string) error {
	if _, err := service.database.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		return fmt.Errorf("checkpoint current database before restore: %w", err)
	}
	if err := service.database.Close(); err != nil {
		return fmt.Errorf("close current database before restore: %w", err)
	}
	rollbackPath := service.databasePath + ".restore-rollback"
	_ = os.Remove(rollbackPath)
	_ = os.Remove(service.databasePath + "-wal")
	_ = os.Remove(service.databasePath + "-shm")
	if err := os.Rename(service.databasePath, rollbackPath); err != nil {
		return service.reopenCurrentAfterRestoreFailure(fmt.Errorf("stage current database rollback: %w", err), rollbackPath)
	}
	if err := os.Rename(stagedPath, service.databasePath); err != nil {
		return service.rollbackDatabaseRestore(fmt.Errorf("install restored database: %w", err), rollbackPath)
	}
	restored, err := openLocalDatabase(service.databasePath)
	if err != nil {
		return service.rollbackDatabaseRestore(fmt.Errorf("open restored database: %w", err), rollbackPath)
	}
	service.database = restored
	_ = os.Remove(rollbackPath)
	return nil
}

func (service *Service) rollbackDatabaseRestore(cause error, rollbackPath string) error {
	removeDatabaseFiles(service.databasePath)
	if err := os.Rename(rollbackPath, service.databasePath); err != nil {
		return fmt.Errorf("%v; restore original database failed: %w", cause, err)
	}
	return service.reopenCurrentAfterRestoreFailure(cause, rollbackPath)
}

func (service *Service) reopenCurrentAfterRestoreFailure(cause error, _ string) error {
	database, err := openLocalDatabase(service.databasePath)
	if err != nil {
		return fmt.Errorf("%v; reopen current database failed: %w", cause, err)
	}
	service.database = database
	return cause
}
