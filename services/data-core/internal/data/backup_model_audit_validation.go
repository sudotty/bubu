package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func validateBackupModelAudits(ctx context.Context, database *sql.DB) error {
	var count int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM model_disclosure_events").Scan(&count); err != nil {
		return fmt.Errorf("count backup model audits: %w", err)
	}
	if count > maximumModelAuditEvents {
		return errors.New("backup exceeds the model disclosure audit limit")
	}
	rows, err := database.QueryContext(ctx, modelAuditSelect)
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
