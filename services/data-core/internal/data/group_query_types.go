package data

type GroupQuerySource struct {
	DatasetID string `json:"datasetId"`
	VersionID string `json:"versionId"`
}

type GroupQueryColumnRef struct {
	SourceIndex int    `json:"sourceIndex"`
	Column      string `json:"column"`
}

type GroupQueryJoin struct {
	LeftSourceIndex  int    `json:"leftSourceIndex"`
	LeftColumn       string `json:"leftColumn"`
	RightSourceIndex int    `json:"rightSourceIndex"`
	RightColumn      string `json:"rightColumn"`
	Type             string `json:"type"`
}

type GroupQueryMeasure struct {
	Operation   string  `json:"operation"`
	SourceIndex int     `json:"sourceIndex"`
	Column      *string `json:"column"`
}

type GroupQueryFilter struct {
	SourceIndex int     `json:"sourceIndex"`
	Column      string  `json:"column"`
	Operator    string  `json:"operator"`
	Value       *string `json:"value,omitempty"`
}

type SafeGroupQueryPlan struct {
	SchemaVersion int                   `json:"schemaVersion"`
	GroupID       string                `json:"groupId"`
	Purpose       string                `json:"purpose"`
	Sources       []GroupQuerySource    `json:"sources"`
	Joins         []GroupQueryJoin      `json:"joins"`
	Dimensions    []GroupQueryColumnRef `json:"dimensions"`
	Measures      []GroupQueryMeasure   `json:"measures"`
	Filters       []GroupQueryFilter    `json:"filters"`
	Sort          []QuerySort           `json:"sort"`
	Limit         int                   `json:"limit"`
}

type SafeGroupQueryResult struct {
	GroupID        string              `json:"groupId"`
	SourceVersions []GroupQuerySource  `json:"sourceVersions"`
	Columns        []QueryResultColumn `json:"columns"`
	Rows           [][]any             `json:"rows"`
	Truncated      bool                `json:"truncated"`
}
