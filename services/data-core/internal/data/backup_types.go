package data

type DataBackupResult struct {
	Status          string `json:"status"`
	FileName        string `json:"fileName"`
	BackupCreatedAt string `json:"backupCreatedAt"`
	DatabaseBytes   int64  `json:"databaseBytes"`
	DatasetCount    int64  `json:"datasetCount"`
	GroupCount      int64  `json:"groupCount"`
}

type DataRestoreResult struct {
	Status          string `json:"status"`
	FileName        string `json:"fileName"`
	BackupCreatedAt string `json:"backupCreatedAt"`
	DatabaseBytes   int64  `json:"databaseBytes"`
	DatasetCount    int64  `json:"datasetCount"`
	GroupCount      int64  `json:"groupCount"`
}

type backupManifest struct {
	FormatVersion   int    `json:"formatVersion"`
	Product         string `json:"product"`
	BackupCreatedAt string `json:"backupCreatedAt"`
	DatabaseSHA256  string `json:"databaseSha256"`
	DatabaseBytes   int64  `json:"databaseBytes"`
	SchemaVersion   int    `json:"schemaVersion"`
	DatasetCount    int64  `json:"datasetCount"`
	GroupCount      int64  `json:"groupCount"`
}
