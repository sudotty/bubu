package data

type ColumnType string

const (
	ColumnTypeNull     ColumnType = "null"
	ColumnTypeBoolean  ColumnType = "boolean"
	ColumnTypeInteger  ColumnType = "integer"
	ColumnTypeReal     ColumnType = "real"
	ColumnTypeDateTime ColumnType = "datetime"
	ColumnTypeText     ColumnType = "text"
)

type DatasetSummary struct {
	ID          string `json:"id"`
	VersionID   string `json:"versionId"`
	DisplayName string `json:"displayName"`
	SourceKind  string `json:"sourceKind"`
	SourceName  string `json:"sourceName"`
	RowCount    int64  `json:"rowCount"`
	ColumnCount int    `json:"columnCount"`
	ImportedAt  string `json:"importedAt"`
	Version     int    `json:"version"`
}

type ColumnProfile struct {
	Ordinal       int        `json:"ordinal"`
	SourceName    string     `json:"sourceName"`
	Name          string     `json:"name"`
	InferredType  ColumnType `json:"inferredType"`
	Nullable      bool       `json:"nullable"`
	NullCount     int64      `json:"nullCount"`
	DistinctCount int64      `json:"distinctCount"`
	MinValue      *string    `json:"minValue"`
	MaxValue      *string    `json:"maxValue"`
}

type ImportResult struct {
	Datasets []DatasetSummary `json:"datasets"`
}

type ReplacementStatus string

const (
	ReplacementApplied         ReplacementStatus = "replaced"
	ReplacementMappingRequired ReplacementStatus = "mapping-required"
)

type SchemaDrift struct {
	CurrentColumns  []string `json:"currentColumns"`
	IncomingColumns []string `json:"incomingColumns"`
	MissingColumns  []string `json:"missingColumns"`
	AddedColumns    []string `json:"addedColumns"`
	Reordered       bool     `json:"reordered"`
}

type ReplacementResult struct {
	Status  ReplacementStatus `json:"status"`
	Dataset *DatasetSummary   `json:"dataset,omitempty"`
	Drift   *SchemaDrift      `json:"drift,omitempty"`
}

type DisclosureLevel string

const (
	DisclosureSchemaOnly      DisclosureLevel = "schema-only"
	DisclosureSchemaSynthetic DisclosureLevel = "schema-synthetic"
)

type ModelContextColumn struct {
	Name     string     `json:"name"`
	Type     ColumnType `json:"type"`
	Nullable bool       `json:"nullable"`
}

type ModelContextResult struct {
	DatasetID     string               `json:"datasetId"`
	VersionID     string               `json:"versionId"`
	Disclosure    DisclosureLevel      `json:"disclosure"`
	Columns       []ModelContextColumn `json:"columns"`
	SyntheticRows [][]any              `json:"syntheticRows"`
}

type PreviewResult struct {
	DatasetID string          `json:"datasetId"`
	VersionID string          `json:"versionId"`
	Columns   []ColumnProfile `json:"columns"`
	Rows      [][]any         `json:"rows"`
	Offset    int             `json:"offset"`
	Limit     int             `json:"limit"`
	TotalRows int64           `json:"totalRows"`
}
