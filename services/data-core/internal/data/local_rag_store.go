package data

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

const maximumKnowledgeSources = 500

func validateKnowledgeDisplayName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]byte(value)) > 200 {
		return "", errors.New("knowledge source display name must contain between 1 and 200 bytes")
	}
	return value, nil
}

func (service *Service) ImportKnowledgeSource(ctx context.Context, input KnowledgeSourceImportInput) (KnowledgeSource, error) {
	displayName, err := validateKnowledgeDisplayName(input.DisplayName)
	if err != nil {
		return KnowledgeSource{}, err
	}
	kind, raw, text, err := extractKnowledgeText(ctx, input.SourcePath)
	if err != nil {
		return KnowledgeSource{}, err
	}
	chunks, err := chunkKnowledgeText(text)
	if err != nil {
		return KnowledgeSource{}, err
	}
	var sourceCount int
	if err := service.database.QueryRowContext(ctx, "SELECT count(*) FROM knowledge_sources").Scan(&sourceCount); err != nil {
		return KnowledgeSource{}, fmt.Errorf("count knowledge sources: %w", err)
	}
	if sourceCount >= maximumKnowledgeSources {
		return KnowledgeSource{}, errors.New("knowledge source limit of 500 has been reached")
	}
	sourceID, err := newID()
	if err != nil {
		return KnowledgeSource{}, err
	}
	versionID, err := newID()
	if err != nil {
		return KnowledgeSource{}, err
	}
	digest := sha256.Sum256(raw)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return KnowledgeSource{}, fmt.Errorf("begin knowledge source import: %w", err)
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, `INSERT INTO knowledge_sources(id, display_name, kind, current_version_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)`, sourceID, displayName, kind, now, now); err != nil {
		return KnowledgeSource{}, fmt.Errorf("create knowledge source: %w", err)
	}
	if err := insertKnowledgeVersion(ctx, transaction, sourceID, versionID, 1, len(raw), hex.EncodeToString(digest[:]), text, chunks, now); err != nil {
		return KnowledgeSource{}, err
	}
	if _, err := transaction.ExecContext(ctx, "UPDATE knowledge_sources SET current_version_id = ? WHERE id = ?", versionID, sourceID); err != nil {
		return KnowledgeSource{}, fmt.Errorf("activate knowledge source version: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return KnowledgeSource{}, fmt.Errorf("commit knowledge source import: %w", err)
	}
	return KnowledgeSource{SchemaVersion: 1, ID: sourceID, VersionID: versionID, DisplayName: displayName, Kind: kind, SourceBytes: int64(len(raw)), SourceSHA256: hex.EncodeToString(digest[:]), ChunkCount: len(chunks), Status: "ready", ImportedAt: now}, nil
}

func insertKnowledgeVersion(ctx context.Context, transaction *sql.Tx, sourceID, versionID string, ordinal, sourceBytes int, sourceSHA, text string, chunks []knowledgeChunk, importedAt string) error {
	if _, err := transaction.ExecContext(ctx, `INSERT INTO knowledge_source_versions(id, source_id, ordinal, source_bytes, source_sha256, raw_text, chunk_count, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, versionID, sourceID, ordinal, sourceBytes, sourceSHA, text, len(chunks), importedAt); err != nil {
		return fmt.Errorf("create knowledge source version: %w", err)
	}
	for _, chunk := range chunks {
		chunkID, err := newID()
		if err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `INSERT INTO knowledge_chunks(id, version_id, ordinal, start_line, end_line, text) VALUES (?, ?, ?, ?, ?, ?)`, chunkID, versionID, chunk.Ordinal, chunk.StartLine, chunk.EndLine, chunk.Text); err != nil {
			return fmt.Errorf("create knowledge chunk: %w", err)
		}
	}
	return nil
}

func (service *Service) ListKnowledgeSources(ctx context.Context) ([]KnowledgeSource, error) {
	rows, err := service.database.QueryContext(ctx, `SELECT s.id, v.id, s.display_name, s.kind, v.source_bytes, v.source_sha256, v.chunk_count, v.imported_at FROM knowledge_sources s JOIN knowledge_source_versions v ON v.id = s.current_version_id ORDER BY lower(s.display_name), s.id`)
	if err != nil {
		return nil, fmt.Errorf("list knowledge sources: %w", err)
	}
	defer rows.Close()
	result := make([]KnowledgeSource, 0)
	for rows.Next() {
		var item KnowledgeSource
		item.SchemaVersion, item.Status = 1, "ready"
		if err := rows.Scan(&item.ID, &item.VersionID, &item.DisplayName, &item.Kind, &item.SourceBytes, &item.SourceSHA256, &item.ChunkCount, &item.ImportedAt); err != nil {
			return nil, fmt.Errorf("read knowledge source: %w", err)
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (service *Service) DeleteKnowledgeSource(ctx context.Context, sourceID string) error {
	if !objectID.MatchString(sourceID) {
		return errors.New("knowledge source identity is invalid")
	}
	result, err := service.database.ExecContext(ctx, "DELETE FROM knowledge_sources WHERE id = ?", sourceID)
	if err != nil {
		return fmt.Errorf("delete knowledge source: %w", err)
	}
	if changed, _ := result.RowsAffected(); changed != 1 {
		return errors.New("knowledge source does not exist")
	}
	return nil
}
