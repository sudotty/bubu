package data

type ModelAuditTarget struct {
	Kind string `json:"kind"`
	ID   string `json:"id,omitempty"`
}

type ModelAuditStartInput struct {
	Purpose              string           `json:"purpose"`
	Target               ModelAuditTarget `json:"target"`
	Disclosure           string           `json:"disclosure"`
	ProviderID           string           `json:"providerId"`
	ProviderKind         string           `json:"providerKind"`
	ProviderName         string           `json:"providerName"`
	Model                string           `json:"model"`
	EndpointOrigin       string           `json:"endpointOrigin"`
	DatasetCount         int              `json:"datasetCount"`
	ColumnCount          int              `json:"columnCount"`
	SyntheticRowCount    int              `json:"syntheticRowCount"`
	AggregateRowCount    int              `json:"aggregateRowCount"`
	RelationshipCount    int              `json:"relationshipCount"`
	PayloadBytes         int              `json:"payloadBytes"`
	EstimatedInputTokens int              `json:"estimatedInputTokens"`
	MaximumOutputTokens  int              `json:"maxOutputTokens"`
	PayloadSHA256        string           `json:"payloadSha256"`
	ContainsRawRows      bool             `json:"containsRawRows"`
}

type ModelAuditFinishInput struct {
	ID           string  `json:"id"`
	Status       string  `json:"status"`
	InputTokens  *int    `json:"inputTokens"`
	OutputTokens *int    `json:"outputTokens"`
	TotalTokens  *int    `json:"totalTokens"`
	OutputBytes  int     `json:"outputBytes"`
	Error        *string `json:"error"`
}

type ModelAuditEvent struct {
	ModelAuditStartInput
	ID           string  `json:"id"`
	Status       string  `json:"status"`
	InputTokens  *int    `json:"inputTokens"`
	OutputTokens *int    `json:"outputTokens"`
	TotalTokens  *int    `json:"totalTokens"`
	OutputBytes  *int    `json:"outputBytes"`
	Error        *string `json:"error"`
	StartedAt    string  `json:"startedAt"`
	FinishedAt   *string `json:"finishedAt"`
}
