package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

func (service *Service) RebuildKnowledgeSource(ctx context.Context, sourceID string) (KnowledgeSource, error) {
	if !objectID.MatchString(sourceID) {
		return KnowledgeSource{}, errors.New("knowledge source identity is invalid")
	}
	transaction, err := service.database.BeginTx(ctx, nil)
	if err != nil {
		return KnowledgeSource{}, fmt.Errorf("begin knowledge source rebuild: %w", err)
	}
	defer transaction.Rollback()
	var displayName, kind, sourceSHA, text string
	var sourceBytes int64
	var ordinal int
	err = transaction.QueryRowContext(ctx, `
SELECT s.display_name, s.kind, v.source_bytes, v.source_sha256, v.raw_text, v.ordinal
FROM knowledge_sources s
JOIN knowledge_source_versions v ON v.id = s.current_version_id
WHERE s.id = ?`, sourceID).Scan(&displayName, &kind, &sourceBytes, &sourceSHA, &text, &ordinal)
	if errors.Is(err, sql.ErrNoRows) {
		return KnowledgeSource{}, errors.New("knowledge source does not exist")
	}
	if err != nil {
		return KnowledgeSource{}, fmt.Errorf("load knowledge source for rebuild: %w", err)
	}
	chunks, err := chunkKnowledgeText(text)
	if err != nil {
		return KnowledgeSource{}, err
	}
	versionID, err := newID()
	if err != nil {
		return KnowledgeSource{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if err := insertKnowledgeVersion(ctx, transaction, sourceID, versionID, ordinal+1, int(sourceBytes), sourceSHA, text, chunks, now); err != nil {
		return KnowledgeSource{}, err
	}
	if _, err := transaction.ExecContext(ctx, "UPDATE knowledge_sources SET current_version_id = ?, updated_at = ? WHERE id = ?", versionID, now, sourceID); err != nil {
		return KnowledgeSource{}, fmt.Errorf("activate rebuilt knowledge source: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return KnowledgeSource{}, fmt.Errorf("commit knowledge source rebuild: %w", err)
	}
	return KnowledgeSource{SchemaVersion: 1, ID: sourceID, VersionID: versionID, DisplayName: displayName, Kind: kind, SourceBytes: sourceBytes, SourceSHA256: sourceSHA, ChunkCount: len(chunks), Status: "ready", ImportedAt: now}, nil
}
