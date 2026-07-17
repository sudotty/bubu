package data

type DatasetExportResult struct {
	Status    string `json:"status"`
	DatasetID string `json:"datasetId"`
	VersionID string `json:"versionId"`
	FileName  string `json:"fileName"`
	RowCount  int64  `json:"rowCount"`
	Mode      string `json:"mode"`
}

type DatasetDeletionResult struct {
	Status          string   `json:"status"`
	DatasetID       string   `json:"datasetId"`
	RemovedGroupIDs []string `json:"removedGroupIds"`
	UpdatedGroupIDs []string `json:"updatedGroupIds"`
}
