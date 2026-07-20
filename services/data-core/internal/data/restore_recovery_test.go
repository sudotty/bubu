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

func TestBackupValidationRejectsForgedWorkflowArtifacts(t *testing.T) {
	service, dataset := importQueryFixture(t)
	definition, err := service.SaveWorkflow(context.Background(), datasetWorkflowInput(t, service, dataset, 1))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.RunWorkflow(
		context.Background(), definition.ID, "123e4567-e89b-42d3-a456-426614174010",
	); err != nil {
		t.Fatal(err)
	}
	snapshotPath := filepath.Join(t.TempDir(), "forged-workflow.db")
	if _, err := service.database.ExecContext(context.Background(), "VACUUM main INTO ?", snapshotPath); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`UPDATE workflow_step_runs
SET result_json = '{"kind":"shell","value":{"command":"rm"}}'
WHERE result_json IS NOT NULL`); err != nil {
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
		t.Fatal("backup containing a forged workflow artifact was accepted")
	}
}

func TestBackupValidationRejectsForgedModelAudit(t *testing.T) {
	service, dataset := importQueryFixture(t)
	if _, err := service.StartModelAudit(context.Background(), datasetModelAuditInput(dataset)); err != nil {
		t.Fatal(err)
	}
	snapshotPath := filepath.Join(t.TempDir(), "forged-model-audit.db")
	if _, err := service.database.ExecContext(context.Background(), "VACUUM main INTO ?", snapshotPath); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec("UPDATE model_disclosure_events SET payload_sha256 = 'not-a-digest'"); err != nil {
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
		t.Fatal("backup containing a forged model audit was accepted")
	}
}

func TestBackupValidationRejectsIncompleteModelAuditPurposeRegistry(t *testing.T) {
	service := openTestService(t, filepath.Join(t.TempDir(), "data"))
	snapshotPath := filepath.Join(t.TempDir(), "incomplete-model-audit-purposes.db")
	if _, err := service.database.ExecContext(context.Background(), "VACUUM main INTO ?", snapshotPath); err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("sqlite", snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec("DELETE FROM model_disclosure_purposes WHERE purpose = 'aggregate-agent'"); err != nil {
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
		t.Fatal("backup with an incomplete model audit purpose registry was accepted")
	}
}
