package data

type QueryMeasure struct {
	Operation string  `json:"operation"`
	Column    *string `json:"column"`
}

type QueryFilter struct {
	Column   string  `json:"column"`
	Operator string  `json:"operator"`
	Value    *string `json:"value,omitempty"`
}

type QuerySort struct {
	OutputIndex int    `json:"outputIndex"`
	Direction   string `json:"direction"`
}

type SafeQueryPlan struct {
	SchemaVersion int            `json:"schemaVersion"`
	DatasetID     string         `json:"datasetId"`
	VersionID     string         `json:"versionId"`
	Purpose       string         `json:"purpose"`
	Dimensions    []string       `json:"dimensions"`
	Measures      []QueryMeasure `json:"measures"`
	Filters       []QueryFilter  `json:"filters"`
	Sort          []QuerySort    `json:"sort"`
	Limit         int            `json:"limit"`
}

type QueryResultColumn struct {
	Label string     `json:"label"`
	Type  ColumnType `json:"type"`
}

type SafeQueryResult struct {
	DatasetID string              `json:"datasetId"`
	VersionID string              `json:"versionId"`
	Columns   []QueryResultColumn `json:"columns"`
	Rows      [][]any             `json:"rows"`
	Truncated bool                `json:"truncated"`
}
