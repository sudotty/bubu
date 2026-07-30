package data

type KnowledgeSourceImportInput struct {
	SourcePath  string `json:"sourcePath"`
	DisplayName string `json:"displayName"`
}

type KnowledgeSource struct {
	SchemaVersion int    `json:"schemaVersion"`
	ID            string `json:"id"`
	VersionID     string `json:"versionId"`
	DisplayName   string `json:"displayName"`
	Kind          string `json:"kind"`
	SourceBytes   int64  `json:"sourceBytes"`
	SourceSHA256  string `json:"sourceSha256"`
	ChunkCount    int    `json:"chunkCount"`
	Status        string `json:"status"`
	ImportedAt    string `json:"importedAt"`
}

type KnowledgeSearchInput struct {
	Query     string   `json:"query"`
	SourceIDs []string `json:"sourceIds"`
	Limit     int      `json:"limit"`
}

type KnowledgeSourceVersionRef struct {
	SourceID  string `json:"sourceId"`
	VersionID string `json:"versionId"`
}

type KnowledgeCitation struct {
	SourceID  string  `json:"sourceId"`
	VersionID string  `json:"versionId"`
	ChunkID   string  `json:"chunkId"`
	Ordinal   int     `json:"ordinal"`
	StartLine int     `json:"startLine"`
	EndLine   int     `json:"endLine"`
	Text      string  `json:"text"`
	Score     float64 `json:"score"`
}

type KnowledgeSearchResult struct {
	SchemaVersion  int                         `json:"schemaVersion"`
	Query          string                      `json:"query"`
	SourceVersions []KnowledgeSourceVersionRef `json:"sourceVersions"`
	Citations      []KnowledgeCitation         `json:"citations"`
	SearchedAt     string                      `json:"searchedAt"`
}

type KnowledgeDisclosurePreview struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Purpose       string              `json:"purpose"`
	Query         string              `json:"query"`
	Citations     []KnowledgeCitation `json:"citations"`
	PayloadBytes  int                 `json:"payloadBytes"`
	PayloadSHA256 string              `json:"payloadSha256"`
}
