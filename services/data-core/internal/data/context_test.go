package data

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestModelContextUsesSyntheticExamplesWithoutSourceValues(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "private-customer-list.csv")
	contents := "Customer,Revenue,Active,Joined\nSECRET-CUSTOMER-9274,987654.32,true,2024-02-03\n"
	if err := os.WriteFile(source, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}

	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFile(context.Background(), source)
	if err != nil {
		t.Fatal(err)
	}
	contextResult, err := service.ModelContext(
		context.Background(),
		imported.Datasets[0].ID,
		DisclosureSchemaSynthetic,
	)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(contextResult)
	if err != nil {
		t.Fatal(err)
	}
	text := string(encoded)
	for _, forbidden := range []string{"SECRET-CUSTOMER-9274", "987654.32", source, "private-customer-list"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("model context disclosed source data %q: %s", forbidden, text)
		}
	}
	if contextResult.Disclosure != DisclosureSchemaSynthetic || len(contextResult.SyntheticRows) != 3 {
		t.Fatalf("unexpected model context: %#v", contextResult)
	}
	if len(contextResult.Columns) != 4 || contextResult.Columns[1].Type != ColumnTypeReal {
		t.Fatalf("unexpected model columns: %#v", contextResult.Columns)
	}
}
