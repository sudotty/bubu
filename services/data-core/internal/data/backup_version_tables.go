package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func backupVersionTables(ctx context.Context, database *sql.DB) (map[string]bool, error) {
	rows, err := database.QueryContext(ctx, "SELECT table_name FROM dataset_versions WHERE status = 'ready'")
	if err != nil {
		return nil, fmt.Errorf("read backup version tables: %w", err)
	}
	defer rows.Close()
	result := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan backup version table: %w", err)
		}
		if !internalTableName.MatchString(name) || result[name] {
			return nil, errors.New("backup contains invalid or duplicate physical table metadata")
		}
		result[name] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate backup version tables: %w", err)
	}
	var nonReady int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM dataset_versions WHERE status <> 'ready'").Scan(&nonReady); err != nil || nonReady != 0 {
		return nil, errors.New("backup contains incomplete dataset versions")
	}
	return result, nil
}
