package data

import "encoding/json"

type DerivedTransformationPlan struct {
	Kind        string              `json:"kind"`
	DatasetPlan *SafeQueryPlan      `json:"plan,omitempty"`
	GroupPlan   *SafeGroupQueryPlan `json:"groupPlan,omitempty"`
	CleanPlan   *DataCleanPlan      `json:"cleanPlan,omitempty"`
}

type DataCleanSource struct {
	DatasetID string `json:"datasetId"`
	VersionID string `json:"versionId"`
}

type DataCleanPredicate struct {
	Column   string          `json:"column"`
	Operator string          `json:"operator"`
	Value    json.RawMessage `json:"value,omitempty"`
}

type DataCleanExpression struct {
	Kind         string          `json:"kind"`
	Value        json.RawMessage `json:"value,omitempty"`
	Columns      []string        `json:"columns,omitempty"`
	Separator    string          `json:"separator,omitempty"`
	Operator     string          `json:"operator,omitempty"`
	LeftColumn   string          `json:"leftColumn,omitempty"`
	RightColumn  string          `json:"rightColumn,omitempty"`
	OnInvalid    string          `json:"onInvalid,omitempty"`
	DivideByZero string          `json:"divideByZero,omitempty"`
}

type DataCleanFill struct {
	Strategy string          `json:"strategy"`
	Value    json.RawMessage `json:"value,omitempty"`
}

type DataCleanColumnMapping struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type DataCleanOperation struct {
	Kind        string                   `json:"kind"`
	Columns     []string                 `json:"columns,omitempty"`
	Column      string                   `json:"column,omitempty"`
	Name        string                   `json:"name,omitempty"`
	To          string                   `json:"to,omitempty"`
	OnInvalid   string                   `json:"onInvalid,omitempty"`
	Match       json.RawMessage          `json:"match,omitempty"`
	Replacement json.RawMessage          `json:"replacement,omitempty"`
	Mode        string                   `json:"mode,omitempty"`
	Expression  *DataCleanExpression     `json:"expression,omitempty"`
	Predicate   *DataCleanPredicate      `json:"predicate,omitempty"`
	Keys        []string                 `json:"keys,omitempty"`
	Keep        string                   `json:"keep,omitempty"`
	Fill        *DataCleanFill           `json:"fill,omitempty"`
	SourceIndex int                      `json:"sourceIndex,omitempty"`
	Mapping     []DataCleanColumnMapping `json:"mapping,omitempty"`
}

type DataCleanPlan struct {
	SchemaVersion int                  `json:"schemaVersion"`
	Purpose       string               `json:"purpose"`
	Sources       []DataCleanSource    `json:"sources"`
	Operations    []DataCleanOperation `json:"operations"`
}

type DerivedDatasetCreateInput struct {
	DisplayName    string                        `json:"displayName"`
	Transformation DerivedTransformationPlan     `json:"transformation"`
	Review         *DerivedMaterializationReview `json:"review,omitempty"`
	QualityPolicy  *DataCleanQualityPolicy       `json:"qualityPolicy,omitempty"`
}

type DerivedMaterializationReview struct {
	Kind                     string `json:"kind"`
	PlanFingerprint          string `json:"planFingerprint"`
	QualityPolicyFingerprint string `json:"qualityPolicyFingerprint,omitempty"`
	ReviewedAt               string `json:"reviewedAt"`
}

type DataCleanQualityRule struct {
	ID                    string   `json:"id"`
	Severity              string   `json:"severity"`
	Kind                  string   `json:"kind"`
	Minimum               *int     `json:"minimum,omitempty"`
	Maximum               *int     `json:"maximum,omitempty"`
	Column                string   `json:"column,omitempty"`
	MinimumRatio          *float64 `json:"minimumRatio,omitempty"`
	Columns               []string `json:"columns,omitempty"`
	Values                []string `json:"values,omitempty"`
	AcceptedTypes         []string `json:"acceptedTypes,omitempty"`
	SourceIndex           *int     `json:"sourceIndex,omitempty"`
	SourceColumn          string   `json:"sourceColumn,omitempty"`
	MaximumRelativeChange *float64 `json:"maximumRelativeChange,omitempty"`
}

type DataCleanQualityPolicy struct {
	SchemaVersion int                    `json:"schemaVersion"`
	Rules         []DataCleanQualityRule `json:"rules"`
}

type DataCleanQualityResult struct {
	RuleID           string `json:"ruleId"`
	Severity         string `json:"severity"`
	Kind             string `json:"kind"`
	Passed           bool   `json:"passed"`
	FailedRows       int    `json:"failedRows"`
	Observed         string `json:"observed"`
	Expected         string `json:"expected"`
	SampleRowNumbers []int  `json:"sampleRowNumbers"`
}

type DataCleanQualityEvidence struct {
	PolicyFingerprint string                   `json:"policyFingerprint"`
	Status            string                   `json:"status"`
	Results           []DataCleanQualityResult `json:"results"`
}

type DataCleanReviewPreview struct {
	Impact  DataCleanImpactPreview   `json:"impact"`
	Quality DataCleanQualityEvidence `json:"quality"`
}

type DataCleanImpactSource struct {
	DatasetID   string   `json:"datasetId"`
	VersionID   string   `json:"versionId"`
	DisplayName string   `json:"displayName"`
	RowCount    int      `json:"rowCount"`
	Columns     []string `json:"columns"`
}

type DataCleanOperationImpact struct {
	Ordinal           int      `json:"ordinal"`
	Kind              string   `json:"kind"`
	BeforeRowCount    int      `json:"beforeRowCount"`
	AfterRowCount     int      `json:"afterRowCount"`
	BeforeColumnCount int      `json:"beforeColumnCount"`
	AfterColumnCount  int      `json:"afterColumnCount"`
	BeforeColumns     []string `json:"beforeColumns"`
	AfterColumns      []string `json:"afterColumns"`
	AffectedRowCount  int      `json:"affectedRowCount"`
}

type DataCleanImpactPreview struct {
	PlanFingerprint string                     `json:"planFingerprint"`
	Sources         []DataCleanImpactSource    `json:"sources"`
	ResultRowCount  int                        `json:"resultRowCount"`
	ResultColumns   []string                   `json:"resultColumns"`
	Operations      []DataCleanOperationImpact `json:"operations"`
}

type DerivedLineageParent struct {
	Ordinal     int    `json:"ordinal"`
	DatasetID   string `json:"datasetId"`
	VersionID   string `json:"versionId"`
	DisplayName string `json:"displayName"`
}

type DerivedDatasetLineage struct {
	DatasetID          string                   `json:"datasetId"`
	VersionID          string                   `json:"versionId"`
	TransformationKind string                   `json:"transformationKind"`
	Purpose            string                   `json:"purpose"`
	PlanFingerprint    string                   `json:"planFingerprint"`
	ExecutionEvidence  DerivedExecutionEvidence `json:"executionEvidence"`
	Parents            []DerivedLineageParent   `json:"parents"`
	CreatedAt          string                   `json:"createdAt"`
}

type DerivedExecutionEvidence struct {
	ExecutionID       string                    `json:"executionId"`
	ReviewKind        string                    `json:"reviewKind"`
	QualityGateStatus string                    `json:"qualityGateStatus"`
	Warnings          []string                  `json:"warnings"`
	CleanImpact       *DataCleanImpactPreview   `json:"cleanImpact"`
	Quality           *DataCleanQualityEvidence `json:"quality"`
}

type DerivedDatasetMaterializationResult struct {
	Dataset DatasetSummary        `json:"dataset"`
	Lineage DerivedDatasetLineage `json:"lineage"`
}
