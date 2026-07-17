package data

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestBackupAndRestoreRoundTripPrivateLocalState(t *testing.T) {
	root := t.TempDir()
	firstPath := filepath.Join(root, "first.csv")
	secondPath := filepath.Join(root, "second.csv")
	if err := os.WriteFile(firstPath, []byte("Key,Value\nA,1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(secondPath, []byte("Key,Value\nB,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFiles(context.Background(), []string{firstPath, secondPath})
	if err != nil {
		t.Fatal(err)
	}
	group, err := service.SaveGroup(context.Background(), "", "Before backup", []string{
		imported.Datasets[0].ID,
		imported.Datasets[1].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	backupPath := filepath.Join(root, "local-data.bubu-backup")
	if err := os.WriteFile(backupPath, []byte("stale backup"), 0o600); err != nil {
		t.Fatal(err)
	}
	created, err := service.CreateBackup(context.Background(), backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if created.FileName != "local-data.bubu-backup" || created.DatasetCount != 2 || created.GroupCount != 1 || created.DatabaseBytes == 0 {
		t.Fatalf("unexpected backup result: %#v", created)
	}
	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("backup permissions are %o, want 600", info.Mode().Perm())
	}
	archive, err := zip.OpenReader(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if len(archive.File) != 2 || archive.File[0].Name != backupManifestName || archive.File[1].Name != backupDatabaseName {
		t.Fatalf("unexpected backup entries: %#v", archive.File)
	}
	archive.Close()

	if _, err := service.DeleteDataset(context.Background(), imported.Datasets[1].ID); err != nil {
		t.Fatal(err)
	}
	restored, err := service.RestoreBackup(context.Background(), backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if restored.DatasetCount != 2 || restored.GroupCount != 1 || restored.BackupCreatedAt != created.BackupCreatedAt {
		t.Fatalf("unexpected restore result: %#v", restored)
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 2 {
		t.Fatalf("restored catalog is incomplete: %#v err=%v", datasets, err)
	}
	groups, err := service.ListGroups(context.Background())
	if err != nil || len(groups) != 1 || groups[0].ID != group.ID || len(groups[0].Members) != 2 {
		t.Fatalf("restored group is incomplete: %#v err=%v", groups, err)
	}
}

func TestRestoreRejectsInvalidArchivesWithoutMutatingCurrentData(t *testing.T) {
	root := t.TempDir()
	sourcePath := filepath.Join(root, "source.csv")
	if err := os.WriteFile(sourcePath, []byte("Name\nCurrent\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	invalidPath := filepath.Join(root, "invalid.bubu-backup")
	if err := os.WriteFile(invalidPath, []byte("not a backup"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.RestoreBackup(context.Background(), invalidPath); err == nil {
		t.Fatal("invalid backup was restored")
	}
	datasets, err := service.ListDatasets(context.Background())
	if err != nil || len(datasets) != 1 || datasets[0].ID != imported.Datasets[0].ID {
		t.Fatalf("failed restore mutated current data: %#v err=%v", datasets, err)
	}
}
