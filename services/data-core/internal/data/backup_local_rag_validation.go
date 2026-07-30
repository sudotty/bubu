package data

import (
	"context"
	"database/sql"
	"errors"
)

func validateBackupKnowledgeSources(ctx context.Context, database *sql.DB) error {
	var sourceCount, invalidSources, invalidVersions, invalidChunks, mismatchedChunks int
	if err := database.QueryRowContext(ctx, "SELECT COUNT(*) FROM knowledge_sources").Scan(&sourceCount); err != nil || sourceCount > maximumKnowledgeSources {
		return errors.New("backup exceeds the local knowledge source limit")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM knowledge_sources s
LEFT JOIN knowledge_source_versions v ON v.id = s.current_version_id AND v.source_id = s.id
WHERE v.id IS NULL`).Scan(&invalidSources); err != nil || invalidSources != 0 {
		return errors.New("backup contains a knowledge source without an exact current version")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM knowledge_source_versions
WHERE ordinal < 1 OR source_bytes < 1 OR source_bytes > ? OR length(source_sha256) <> 64
   OR length(raw_text) < 1 OR length(raw_text) > ? OR chunk_count < 1 OR chunk_count > ?`, maximumKnowledgeSourceBytes, maximumKnowledgeTextBytes, maximumKnowledgeChunks).Scan(&invalidVersions); err != nil || invalidVersions != 0 {
		return errors.New("backup contains invalid local knowledge version metadata")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM knowledge_chunks
WHERE ordinal < 0 OR ordinal >= ? OR start_line < 1 OR end_line < start_line
   OR length(text) < 1 OR length(CAST(text AS BLOB)) > ?`, maximumKnowledgeChunks, maximumKnowledgeChunkBytes).Scan(&invalidChunks); err != nil || invalidChunks != 0 {
		return errors.New("backup contains invalid local knowledge chunks")
	}
	if err := database.QueryRowContext(ctx, `
SELECT COUNT(*) FROM (
  SELECT v.id FROM knowledge_source_versions v
  LEFT JOIN knowledge_chunks c ON c.version_id = v.id
  GROUP BY v.id HAVING COUNT(c.id) <> v.chunk_count
)`).Scan(&mismatchedChunks); err != nil || mismatchedChunks != 0 {
		return errors.New("backup local knowledge chunk counts do not match version metadata")
	}
	return nil
}
