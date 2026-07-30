package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
)

var knowledgeSearchToken = regexp.MustCompile(`[\pL\pN_]+`)

func validateKnowledgeSearch(input KnowledgeSearchInput) (KnowledgeSearchInput, string, error) {
	input.Query = strings.TrimSpace(input.Query)
	if input.Query == "" || len([]byte(input.Query)) > 500 || input.Limit < 1 || input.Limit > 12 || len(input.SourceIDs) > 50 {
		return KnowledgeSearchInput{}, "", errors.New("knowledge search query, source scope, or limit is invalid")
	}
	seen := make(map[string]bool, len(input.SourceIDs))
	for _, id := range input.SourceIDs {
		if !objectID.MatchString(id) || seen[id] {
			return KnowledgeSearchInput{}, "", errors.New("knowledge search source identities must be valid and unique")
		}
		seen[id] = true
	}
	tokens, containsHan := knowledgeFTSTerms(input.Query)
	if len(tokens) == 0 {
		return KnowledgeSearchInput{}, "", errors.New("knowledge search query contains no searchable terms")
	}
	ftsTerms := make([]string, len(tokens))
	for index, token := range tokens {
		if len([]byte(token)) > 64 {
			token = string([]byte(token)[:64])
		}
		ftsTerms[index] = `"` + strings.ReplaceAll(token, `"`, `""`) + `"*`
	}
	operator := " AND "
	if containsHan {
		operator = " OR "
	}
	return input, strings.Join(ftsTerms, operator), nil
}

func knowledgeFTSTerms(query string) ([]string, bool) {
	result := make([]string, 0, 16)
	seen := make(map[string]bool)
	containsHan := false
	add := func(term string) {
		if term != "" && !seen[term] && len(result) < 16 {
			seen[term] = true
			result = append(result, term)
		}
	}
	for _, token := range knowledgeSearchToken.FindAllString(query, 16) {
		runes := []rune(token)
		hasHan := false
		for _, value := range runes {
			if unicode.Is(unicode.Han, value) {
				hasHan, containsHan = true, true
			}
		}
		if !hasHan {
			add(token)
			continue
		}
		for index := 0; index < len(runes) && len(result) < 16; index++ {
			if !unicode.Is(unicode.Han, runes[index]) {
				continue
			}
			end := index + 1
			if end < len(runes) && unicode.Is(unicode.Han, runes[end]) {
				end++
			}
			add(string(runes[index:end]))
		}
	}
	return result, containsHan
}

func (service *Service) SearchKnowledge(ctx context.Context, input KnowledgeSearchInput) (KnowledgeSearchResult, error) {
	input, match, err := validateKnowledgeSearch(input)
	if err != nil {
		return KnowledgeSearchResult{}, err
	}
	refs, err := service.currentKnowledgeVersions(ctx, input.SourceIDs)
	if err != nil {
		return KnowledgeSearchResult{}, err
	}
	if len(refs) == 0 {
		return KnowledgeSearchResult{}, errors.New("knowledge search requires at least one ready local source")
	}
	query := `SELECT s.id, v.id, c.id, c.ordinal, c.start_line, c.end_line, c.text
FROM knowledge_chunks_fts f
JOIN knowledge_chunks c ON c.rowid = f.rowid
JOIN knowledge_source_versions v ON v.id = c.version_id
JOIN knowledge_sources s ON s.current_version_id = v.id
WHERE knowledge_chunks_fts MATCH ?`
	arguments := []any{match}
	if len(input.SourceIDs) > 0 {
		query += " AND s.id IN (" + strings.TrimRight(strings.Repeat("?,", len(input.SourceIDs)), ",") + ")"
		for _, id := range input.SourceIDs {
			arguments = append(arguments, id)
		}
	}
	query += " ORDER BY bm25(knowledge_chunks_fts), s.id, c.ordinal LIMIT ?"
	arguments = append(arguments, input.Limit)
	rows, err := service.database.QueryContext(ctx, query, arguments...)
	if err != nil {
		return KnowledgeSearchResult{}, fmt.Errorf("search local knowledge: %w", err)
	}
	defer rows.Close()
	citations := make([]KnowledgeCitation, 0, input.Limit)
	for rows.Next() {
		var citation KnowledgeCitation
		if err := rows.Scan(&citation.SourceID, &citation.VersionID, &citation.ChunkID, &citation.Ordinal, &citation.StartLine, &citation.EndLine, &citation.Text); err != nil {
			return KnowledgeSearchResult{}, fmt.Errorf("read local knowledge search result: %w", err)
		}
		citation.Score = 1 / float64(len(citations)+1)
		citations = append(citations, citation)
	}
	if err := rows.Err(); err != nil {
		return KnowledgeSearchResult{}, err
	}
	return KnowledgeSearchResult{SchemaVersion: 1, Query: input.Query, SourceVersions: refs, Citations: citations, SearchedAt: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}

func (service *Service) currentKnowledgeVersions(ctx context.Context, sourceIDs []string) ([]KnowledgeSourceVersionRef, error) {
	query, arguments := "SELECT id, current_version_id FROM knowledge_sources", []any{}
	if len(sourceIDs) > 0 {
		query += " WHERE id IN (" + strings.TrimRight(strings.Repeat("?,", len(sourceIDs)), ",") + ")"
		for _, id := range sourceIDs {
			arguments = append(arguments, id)
		}
	}
	query += " ORDER BY id"
	rows, err := service.database.QueryContext(ctx, query, arguments...)
	if err != nil {
		return nil, fmt.Errorf("load current knowledge versions: %w", err)
	}
	defer rows.Close()
	refs := make([]KnowledgeSourceVersionRef, 0)
	for rows.Next() {
		var ref KnowledgeSourceVersionRef
		if err := rows.Scan(&ref.SourceID, &ref.VersionID); err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	if len(sourceIDs) > 0 && len(refs) != len(sourceIDs) {
		return nil, errors.New("one or more knowledge sources do not exist")
	}
	sort.Slice(refs, func(left, right int) bool { return refs[left].SourceID < refs[right].SourceID })
	return refs, rows.Err()
}

func scanKnowledgeCitation(row *sql.Row) (KnowledgeCitation, error) {
	var citation KnowledgeCitation
	err := row.Scan(&citation.SourceID, &citation.VersionID, &citation.ChunkID, &citation.Ordinal, &citation.StartLine, &citation.EndLine, &citation.Text)
	return citation, err
}
