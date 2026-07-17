package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestColumnDistributionIsBoundedAndComputedLocally(t *testing.T) {
	root := t.TempDir()
	sourcePath := filepath.Join(root, "distribution.csv")
	contents := "Region,Amount,Empty\nNorth,10,\nSouth,20,\nNorth,30,\nEast,40,\nNorth,50,\n"
	if err := os.WriteFile(sourcePath, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	datasetID := imported.Datasets[0].ID
	categoricalRaw, err := service.GetColumnDistribution(context.Background(), datasetID, "Region")
	if err != nil {
		t.Fatal(err)
	}
	categorical, ok := categoricalRaw.(CategoricalColumnDistribution)
	if !ok || !categorical.LocalOnly || categorical.Values[0].Preview != "North" || categorical.Values[0].Count != 3 || categorical.OtherCount != 0 {
		t.Fatalf("unexpected categorical distribution: %#v", categoricalRaw)
	}
	numericRaw, err := service.GetColumnDistribution(context.Background(), datasetID, "Amount")
	if err != nil {
		t.Fatal(err)
	}
	numeric, ok := numericRaw.(NumericColumnDistribution)
	if !ok || numeric.Minimum != 10 || numeric.Maximum != 50 || numeric.Mean != 30 || len(numeric.Bins) != 10 {
		t.Fatalf("unexpected numeric distribution: %#v", numericRaw)
	}
	var histogramRows int64
	for _, bin := range numeric.Bins {
		histogramRows += bin.Count
	}
	if histogramRows != 5 {
		t.Fatalf("histogram lost rows: %#v", numeric.Bins)
	}
	emptyRaw, err := service.GetColumnDistribution(context.Background(), datasetID, "Empty")
	if err != nil {
		t.Fatal(err)
	}
	if empty, ok := emptyRaw.(EmptyColumnDistribution); !ok || empty.NonNullCount != 0 {
		t.Fatalf("unexpected empty distribution: %#v", emptyRaw)
	}
}

func TestCategoricalDistributionSanitizesAndTruncatesPreviews(t *testing.T) {
	root := t.TempDir()
	sourcePath := filepath.Join(root, "long.csv")
	longValue := "line\t" + strings.Repeat("x", 130)
	if err := os.WriteFile(sourcePath, []byte("Value\n\""+longValue+"\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := service.GetColumnDistribution(context.Background(), imported.Datasets[0].ID, "Value")
	if err != nil {
		t.Fatal(err)
	}
	result := raw.(CategoricalColumnDistribution)
	if !result.Values[0].Truncated || len([]rune(result.Values[0].Preview)) > distributionPreviewRunes || !strings.Contains(result.Values[0].Preview, "⇥") {
		t.Fatalf("categorical preview was not bounded: %#v", result.Values[0])
	}
}
