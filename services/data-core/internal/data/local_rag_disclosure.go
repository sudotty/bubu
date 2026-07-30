package data

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const maximumKnowledgeDisclosurePayloadBytes = 64 * 1024

type knowledgeDisclosurePayload struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Purpose       string              `json:"purpose"`
	Query         string              `json:"query"`
	Citations     []KnowledgeCitation `json:"citations"`
}

func (service *Service) PreviewKnowledgeDisclosure(ctx context.Context, purpose string, result KnowledgeSearchResult) (KnowledgeDisclosurePreview, error) {
	purpose = strings.TrimSpace(purpose)
	if purpose == "" || len([]byte(purpose)) > 500 || result.SchemaVersion != 1 || strings.TrimSpace(result.Query) == "" || len(result.Citations) < 1 || len(result.Citations) > 12 {
		return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure purpose or search result is invalid")
	}
	current, err := service.currentKnowledgeVersions(ctx, sourceIDsFromRefs(result.SourceVersions))
	if err != nil || !equalKnowledgeVersionRefs(current, result.SourceVersions) {
		return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure requires exact current source versions")
	}
	seenChunks := make(map[string]bool, len(result.Citations))
	for _, citation := range result.Citations {
		if seenChunks[citation.ChunkID] {
			return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure citations must be unique")
		}
		seenChunks[citation.ChunkID] = true
		stored, err := scanKnowledgeCitation(service.database.QueryRowContext(ctx, `
SELECT s.id, v.id, c.id, c.ordinal, c.start_line, c.end_line, c.text
FROM knowledge_chunks c
JOIN knowledge_source_versions v ON v.id = c.version_id
JOIN knowledge_sources s ON s.current_version_id = v.id
WHERE c.id = ?`, citation.ChunkID))
		if errors.Is(err, sql.ErrNoRows) {
			return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure contains a stale or deleted citation")
		}
		if err != nil {
			return KnowledgeDisclosurePreview{}, fmt.Errorf("validate knowledge disclosure citation: %w", err)
		}
		if stored.SourceID != citation.SourceID || stored.VersionID != citation.VersionID || stored.Ordinal != citation.Ordinal || stored.StartLine != citation.StartLine || stored.EndLine != citation.EndLine || stored.Text != citation.Text || citation.Score <= 0 || citation.Score > 1 {
			return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure citation does not match authoritative local content")
		}
	}
	payload := knowledgeDisclosurePayload{SchemaVersion: 1, Purpose: purpose, Query: result.Query, Citations: result.Citations}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return KnowledgeDisclosurePreview{}, fmt.Errorf("encode knowledge disclosure: %w", err)
	}
	if len(encoded) > maximumKnowledgeDisclosurePayloadBytes {
		return KnowledgeDisclosurePreview{}, errors.New("knowledge disclosure exceeds its 64 KiB payload budget")
	}
	digest := sha256.Sum256(encoded)
	return KnowledgeDisclosurePreview{SchemaVersion: 1, Purpose: purpose, Query: result.Query, Citations: result.Citations, PayloadBytes: len(encoded), PayloadSHA256: hex.EncodeToString(digest[:])}, nil
}

func sourceIDsFromRefs(refs []KnowledgeSourceVersionRef) []string {
	result := make([]string, len(refs))
	for index, ref := range refs {
		result[index] = ref.SourceID
	}
	return result
}

func equalKnowledgeVersionRefs(left, right []KnowledgeSourceVersionRef) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] || !objectID.MatchString(right[index].SourceID) || !objectID.MatchString(right[index].VersionID) {
			return false
		}
	}
	return true
}
