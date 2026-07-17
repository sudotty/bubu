package data

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenRecoversAnInterruptedDatabaseSwap(t *testing.T) {
	root := t.TempDir()
	dataDirectory := filepath.Join(root, "data")
	sourcePath := filepath.Join(root, "source.csv")
	if err := os.WriteFile(sourcePath, []byte("Name\nRecover me\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service, err := Open(dataDirectory)
	if err != nil {
		t.Fatal(err)
	}
	imported, err := service.ImportFile(context.Background(), sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Close(); err != nil {
		t.Fatal(err)
	}
	databasePath := filepath.Join(dataDirectory, "bubu.db")
	rollbackPath := databasePath + ".restore-rollback"
	if err := os.Rename(databasePath, rollbackPath); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(databasePath, []byte("invalid staged database"), 0o600); err != nil {
		t.Fatal(err)
	}

	recovered, err := Open(dataDirectory)
	if err != nil {
		t.Fatal(err)
	}
	defer recovered.Close()
	datasets, err := recovered.ListDatasets(context.Background())
	if err != nil || len(datasets) != 1 || datasets[0].ID != imported.Datasets[0].ID {
		t.Fatalf("startup did not recover the pre-restore database: %#v err=%v", datasets, err)
	}
	if _, err := os.Stat(rollbackPath); !os.IsNotExist(err) {
		t.Fatalf("consumed restore rollback survived startup: %v", err)
	}
}

func TestBackupValidationRejectsDatabaseTriggers(t *testing.T) {
	root := t.TempDir()
	service := openTestService(t, filepath.Join(root, "data"))
	snapshotPath := filepath.Join(root, "snapshot.db")
	if _, err := service.database.ExecContext(context.Background(), "VACUUM main INTO ?", snapshotPath); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`
CREATE TRIGGER forbidden_restore_trigger
AFTER INSERT ON datasets
BEGIN
  SELECT 1;
END`); err != nil {
		database.Close()
		t.Fatal(err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	manifest, err := buildBackupManifest(context.Background(), snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateBackupDatabase(context.Background(), snapshotPath, manifest); err == nil {
		t.Fatal("backup database containing a trigger was accepted")
	}
}
