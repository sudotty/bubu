package data

type DerivedDependencyPlan struct {
	SourceDatasetID   string   `json:"sourceDatasetId"`
	OrderedDatasetIDs []string `json:"orderedDatasetIds"`
	EdgeCount         int      `json:"edgeCount"`
}

type DerivedRecomputeEvent struct {
	ID                string  `json:"id"`
	SourceDatasetID   string  `json:"sourceDatasetId"`
	SourceVersionID   string  `json:"sourceVersionId"`
	TargetDatasetID   string  `json:"targetDatasetId"`
	TargetDisplayName string  `json:"targetDisplayName"`
	Status            string  `json:"status"`
	ReasonKind        *string `json:"reasonKind"`
	Error             *string `json:"error"`
	ResultVersionID   *string `json:"resultVersionId"`
	Attempt           int     `json:"attempt"`
	CreatedAt         string  `json:"createdAt"`
	StartedAt         *string `json:"startedAt"`
	FinishedAt        *string `json:"finishedAt"`
}
