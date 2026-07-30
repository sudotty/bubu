package data

type ComparisonSource struct {
	DatasetID string `json:"datasetId"`
	VersionID string `json:"versionId"`
}
type ComparisonSources struct {
	Left  ComparisonSource `json:"left"`
	Right ComparisonSource `json:"right"`
}
type ComparisonKey struct {
	LeftColumn    string   `json:"leftColumn"`
	RightColumn   string   `json:"rightColumn"`
	Normalization []string `json:"normalization"`
}
type ComparisonAmountTolerance struct {
	LeftColumn  string  `json:"leftColumn"`
	RightColumn string  `json:"rightColumn"`
	Absolute    float64 `json:"absolute"`
}
type ComparisonDateTolerance struct {
	LeftColumn  string `json:"leftColumn"`
	RightColumn string `json:"rightColumn"`
	Days        int    `json:"days"`
}
type ComparisonMatch struct {
	Keys            []ComparisonKey            `json:"keys"`
	Cardinality     string                     `json:"cardinality"`
	AmountTolerance *ComparisonAmountTolerance `json:"amountTolerance,omitempty"`
	DateTolerance   *ComparisonDateTolerance   `json:"dateTolerance,omitempty"`
}
type ComparisonBudgets struct {
	MaximumCandidatePairs int `json:"maximumCandidatePairs"`
	TimeoutMS             int `json:"timeoutMs"`
}
type ComparisonPlan struct {
	SchemaVersion int               `json:"schemaVersion"`
	Purpose       string            `json:"purpose"`
	Sources       ComparisonSources `json:"sources"`
	Match         ComparisonMatch   `json:"match"`
	Budgets       ComparisonBudgets `json:"budgets"`
}
type ReconciliationControlTotal struct {
	ID          string  `json:"id"`
	LeftColumn  string  `json:"leftColumn"`
	RightColumn string  `json:"rightColumn"`
	Aggregation string  `json:"aggregation"`
	Tolerance   float64 `json:"tolerance"`
}
type ReconciliationPlan struct {
	SchemaVersion    int                          `json:"schemaVersion"`
	Purpose          string                       `json:"purpose"`
	Comparison       ComparisonPlan               `json:"comparison"`
	ControlTotals    []ReconciliationControlTotal `json:"controlTotals"`
	UnresolvedPolicy string                       `json:"unresolvedPolicy"`
}
type ComparisonRow struct {
	RowNumber int               `json:"rowNumber"`
	Values    map[string]string `json:"values"`
}
type ComparisonClassification struct {
	Category       string `json:"category"`
	LeftRowNumber  *int   `json:"leftRowNumber,omitempty"`
	RightRowNumber *int   `json:"rightRowNumber,omitempty"`
	Key            string `json:"key"`
	Reason         string `json:"reason"`
}
type ReconciliationSourceEvidence struct {
	Side         string `json:"side"`
	DatasetID    string `json:"datasetId"`
	VersionID    string `json:"versionId"`
	DisplayName  string `json:"displayName"`
	RowCount     int    `json:"rowCount"`
	QualityScore int    `json:"qualityScore"`
}
type ReconciliationCounts struct {
	Matched          int `json:"matched"`
	ToleranceMatched int `json:"toleranceMatched"`
	LeftUnmatched    int `json:"leftUnmatched"`
	RightUnmatched   int `json:"rightUnmatched"`
	LeftDuplicate    int `json:"leftDuplicate"`
	RightDuplicate   int `json:"rightDuplicate"`
	Conflict         int `json:"conflict"`
	Pending          int `json:"pending"`
}
type ReconciliationControlTotalResult struct {
	ID         string  `json:"id"`
	LeftValue  float64 `json:"leftValue"`
	RightValue float64 `json:"rightValue"`
	Difference float64 `json:"difference"`
	Tolerance  float64 `json:"tolerance"`
	Balanced   bool    `json:"balanced"`
}
type ReconciliationPreview struct {
	PlanFingerprint string                             `json:"planFingerprint"`
	Sources         []ReconciliationSourceEvidence     `json:"sources"`
	CandidatePairs  int                                `json:"candidatePairs"`
	Counts          ReconciliationCounts               `json:"counts"`
	ControlTotals   []ReconciliationControlTotalResult `json:"controlTotals"`
	Limitations     []string                           `json:"limitations"`
}
type ReconciliationReview struct {
	Kind            string `json:"kind"`
	PlanFingerprint string `json:"planFingerprint"`
	ReviewedAt      string `json:"reviewedAt"`
}
type ReconciliationArtifact struct {
	SchemaVersion int                `json:"schemaVersion"`
	ID            string             `json:"id"`
	CreatedAt     string             `json:"createdAt"`
	Plan          ReconciliationPlan `json:"plan"`
	ReconciliationPreview
	Classifications []ComparisonClassification `json:"classifications"`
	Completion      ReconciliationCompletion   `json:"completion"`
}
type ReconciliationCompletion struct {
	Status              string  `json:"status"`
	ClassificationCount int     `json:"classificationCount"`
	ReviewKind          string  `json:"reviewKind"`
	DefinitionID        *string `json:"definitionId"`
}
type ComparisonExecutionResult struct {
	Classifications []ComparisonClassification `json:"classifications"`
	CandidatePairs  int                        `json:"candidatePairs"`
}
