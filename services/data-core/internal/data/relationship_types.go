package data

type RelationshipEndpoint struct {
	DatasetID string `json:"datasetId"`
	Column    string `json:"column"`
}

type DatasetRelationshipSaveInput struct {
	Left  RelationshipEndpoint `json:"left"`
	Right RelationshipEndpoint `json:"right"`
}

type DatasetRelationship struct {
	ID        string               `json:"id"`
	Kind      string               `json:"kind"`
	Left      RelationshipEndpoint `json:"left"`
	Right     RelationshipEndpoint `json:"right"`
	Status    string               `json:"status"`
	Issue     *string              `json:"issue"`
	CreatedAt string               `json:"createdAt"`
}

type RelationshipCandidate struct {
	Left   RelationshipEndpoint `json:"left"`
	Right  RelationshipEndpoint `json:"right"`
	Reason string               `json:"reason"`
}

type GroupRelationshipOverview struct {
	GroupID       string                  `json:"groupId"`
	Relationships []DatasetRelationship   `json:"relationships"`
	Candidates    []RelationshipCandidate `json:"candidates"`
}
