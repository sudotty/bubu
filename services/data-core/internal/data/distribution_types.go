package data

type ColumnDistribution interface {
	columnDistribution()
}

type ColumnDistributionBase struct {
	LocalOnly    bool       `json:"localOnly"`
	DatasetID    string     `json:"datasetId"`
	VersionID    string     `json:"versionId"`
	Column       string     `json:"column"`
	InferredType ColumnType `json:"inferredType"`
	NonNullCount int64      `json:"nonNullCount"`
}

type EmptyColumnDistribution struct {
	Kind string `json:"kind"`
	ColumnDistributionBase
}

type HistogramBin struct {
	Minimum float64 `json:"minimum"`
	Maximum float64 `json:"maximum"`
	Count   int64   `json:"count"`
	Rate    float64 `json:"rate"`
}

type NumericColumnDistribution struct {
	Kind string `json:"kind"`
	ColumnDistributionBase
	Minimum float64        `json:"minimum"`
	Maximum float64        `json:"maximum"`
	Mean    float64        `json:"mean"`
	Bins    []HistogramBin `json:"bins"`
}

type FrequentValue struct {
	Preview   string  `json:"preview"`
	Truncated bool    `json:"truncated"`
	Count     int64   `json:"count"`
	Rate      float64 `json:"rate"`
}

type CategoricalColumnDistribution struct {
	Kind string `json:"kind"`
	ColumnDistributionBase
	Values     []FrequentValue `json:"values"`
	OtherCount int64           `json:"otherCount"`
}

func (EmptyColumnDistribution) columnDistribution()       {}
func (NumericColumnDistribution) columnDistribution()     {}
func (CategoricalColumnDistribution) columnDistribution() {}
