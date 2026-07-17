package rpc

import (
	"context"
	"testing"

	"github.com/sudotty/bubu/services/data-core/internal/data"
)

func (fake *fakeDatasets) GetColumnDistribution(
	_ context.Context,
	datasetID string,
	columnName string,
) (data.ColumnDistribution, error) {
	fake.distributionID = datasetID
	fake.distributionColumn = columnName
	return data.EmptyColumnDistribution{
		Kind: "empty",
		ColumnDistributionBase: data.ColumnDistributionBase{
			LocalOnly: true, DatasetID: datasetID, VersionID: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			Column: columnName, InferredType: data.ColumnTypeNull,
		},
	}, nil
}

func TestDistributionDelegatesASelectedLocalColumn(t *testing.T) {
	fake := &fakeDatasets{}
	response := HandleWithData(context.Background(), Request{
		ProtocolVersion: ProtocolVersion,
		Auth:            testToken,
		ID:              "distribution-1",
		Method:          "dataset.distribution.get",
		Params: map[string]any{
			"datasetId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"column":    "Region",
		},
	}, testToken, fake)
	if !response.OK || fake.distributionID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" || fake.distributionColumn != "Region" {
		t.Fatalf("unexpected distribution response: %#v id=%q column=%q", response, fake.distributionID, fake.distributionColumn)
	}
}
