package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) CreateBackup(
	_ context.Context,
	targetPath string,
) (data.DataBackupResult, error) {
	fake.backupPath = targetPath
	return data.DataBackupResult{Status: "created", FileName: "backup.bubu-backup"}, nil
}

func (fake *fakeDatasets) RestoreBackup(
	_ context.Context,
	sourcePath string,
) (data.DataRestoreResult, error) {
	fake.restorePath = sourcePath
	return data.DataRestoreResult{Status: "restored", FileName: "backup.bubu-backup"}, nil
}

func TestDataBackupDelegatesOnlyAnExplicitPrivatePath(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "backup-1",
		Method:          "data.backup.create",
		Params:          map[string]any{"targetPath": "/tmp/local.bubu-backup"},
	}, testToken, fake)
	if !response.OK || fake.backupPath != "/tmp/local.bubu-backup" {
		t.Fatalf("unexpected backup response: %#v path=%q", response, fake.backupPath)
	}
}

func TestDataRestoreRejectsAMissingPath(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "restore-1",
		Method:          "data.backup.restore",
		Params:          map[string]any{},
	}, testToken, fake)
	if response.OK || response.Error == nil || response.Error.Code != "INVALID_ARGUMENT" || fake.restorePath != "" {
		t.Fatalf("unexpected restore response: %#v path=%q", response, fake.restorePath)
	}
}
