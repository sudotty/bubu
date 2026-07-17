package data

type ValidationRule struct {
	Kind    string   `json:"kind"`
	Column  string   `json:"column"`
	Minimum *float64 `json:"minimum,omitempty"`
	Maximum *float64 `json:"maximum,omitempty"`
	Pattern string   `json:"pattern,omitempty"`
	Values  []string `json:"values,omitempty"`
}

type ColumnQuality struct {
	Name          string     `json:"name"`
	InferredType  ColumnType `json:"inferredType"`
	RowCount      int64      `json:"rowCount"`
	NullCount     int64      `json:"nullCount"`
	NullRate      float64    `json:"nullRate"`
	DistinctCount int64      `json:"distinctCount"`
	DistinctRate  float64    `json:"distinctRate"`
	MinValue      *string    `json:"minValue"`
	MaxValue      *string    `json:"maxValue"`
}

type QualityFinding struct {
	Kind     string  `json:"kind"`
	Severity string  `json:"severity"`
	Column   *string `json:"column"`
}

type ValidationResult struct {
	RuleIndex        int     `json:"ruleIndex"`
	Kind             string  `json:"kind"`
	Column           string  `json:"column"`
	FailedRows       int64   `json:"failedRows"`
	SampleRowNumbers []int64 `json:"sampleRowNumbers"`
}

type DatasetQualityReport struct {
	DatasetID  string             `json:"datasetId"`
	VersionID  string             `json:"versionId"`
	RowCount   int64              `json:"rowCount"`
	Score      int                `json:"score"`
	Columns    []ColumnQuality    `json:"columns"`
	Findings   []QualityFinding   `json:"findings"`
	Rules      []ValidationRule   `json:"rules"`
	Validation []ValidationResult `json:"validation"`
}
