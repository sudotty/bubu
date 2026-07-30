package data

import (
	"errors"
	"strings"
)

const maximumKnowledgeChunks = 2_000
const maximumKnowledgeChunkBytes = 6_000
const maximumKnowledgeChunkLines = 40

type knowledgeChunk struct {
	Ordinal   int
	StartLine int
	EndLine   int
	Text      string
}

func chunkKnowledgeText(text string) ([]knowledgeChunk, error) {
	lines := strings.Split(text, "\n")
	chunks := make([]knowledgeChunk, 0, len(lines)/maximumKnowledgeChunkLines+1)
	for start := 0; start < len(lines); {
		end := start
		var selected []string
		for end < len(lines) && end-start < maximumKnowledgeChunkLines {
			candidate := append(selected, lines[end])
			if len([]byte(strings.Join(candidate, "\n"))) > maximumKnowledgeChunkBytes && len(selected) > 0 {
				break
			}
			if len([]byte(lines[end])) > maximumKnowledgeChunkBytes {
				return nil, errors.New("knowledge source contains a line larger than the chunk budget")
			}
			selected = candidate
			end++
		}
		value := strings.TrimSpace(strings.Join(selected, "\n"))
		if value != "" {
			chunks = append(chunks, knowledgeChunk{Ordinal: len(chunks), StartLine: start + 1, EndLine: end, Text: value})
		}
		start = end
		if len(chunks) > maximumKnowledgeChunks {
			return nil, errors.New("knowledge source exceeds the 2000-chunk budget")
		}
	}
	if len(chunks) == 0 {
		return nil, errors.New("knowledge source produced no searchable chunks")
	}
	return chunks, nil
}
