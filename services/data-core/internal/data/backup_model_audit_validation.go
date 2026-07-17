package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func validateBackupModelAudits(ctx context.Context, database *sql.DB, schemaVersion int) error {
	if schemaVersion >= 12 {
		if err := validateBackupModelAuditPurposes(ctx, database); err != nil {
			return err
		}
	}
	var count int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM model_disclosure_events").Scan(&count); err != nil {
		return fmt.Errorf("count backup model audits: %w", err)
	}
	if count > maximumModelAuditEvents {
		return errors.New("backup exceeds the model disclosure audit limit")
	}
	rows, err := database.QueryContext(ctx, modelAuditSelect(schemaVersion))
	if err != nil {
		return fmt.Errorf("inspect backup model audits: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		if _, err := scanModelAudit(rows); err != nil {
			return fmt.Errorf("backup contains an invalid model audit: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate backup model audits: %w", err)
	}
	return nil
}

func validateBackupModelAuditPurposes(ctx context.Context, database *sql.DB) error {
	rows, err := database.QueryContext(ctx, "SELECT purpose FROM model_disclosure_purposes ORDER BY purpose")
	if err != nil {
		return fmt.Errorf("inspect backup model audit purposes: %w", err)
	}
	defer rows.Close()
	expected := []string{
		"aggregate-agent", "aggregate-explanation", "group-query-plan",
		"provider-connection-test", "query-plan",
	}
	index := 0
	for rows.Next() {
		var purpose string
		if err := rows.Scan(&purpose); err != nil {
			return fmt.Errorf("scan backup model audit purpose: %w", err)
		}
		if index >= len(expected) || purpose != expected[index] {
			return errors.New("backup contains an invalid model audit purpose registry")
		}
		index++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate backup model audit purposes: %w", err)
	}
	if index != len(expected) {
		return errors.New("backup model audit purpose registry is incomplete")
	}
	return nil
}
