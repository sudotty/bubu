package rpc

import "github.com/sudotty/bubu/services/data-core/internal/data"

type fakeDatasets struct {
	importedPath         string
	importedPaths        []string
	replacedID           string
	replacedPath         string
	replacedMappings     []data.ColumnMapping
	inspectedPath        string
	savedRules           []data.ValidationRule
	savedRelationship    data.DatasetRelationshipSaveInput
	exportedID           string
	exportedPath         string
	deletedID            string
	backupPath           string
	restorePath          string
	distributionID       string
	distributionColumn   string
	waitForCancellation  bool
	derivedInput         data.DerivedDatasetCreateInput
	recomputedID         string
	lineageID            string
	reconciliationPlan   data.ReconciliationPlan
	reconciliationReview data.ReconciliationReview
	explicitRowSelection data.ExplicitRowDisclosureSelection
}
