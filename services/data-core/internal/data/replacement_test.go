package data

import "testing"

func TestCompareSchemasDistinguishesRenameAndReorder(t *testing.T) {
	renamed := CompareSchemas([]string{"Order", "Amount"}, []string{"Order", "Total"})
	if len(renamed.MissingColumns) != 1 || renamed.MissingColumns[0] != "Amount" {
		t.Fatalf("unexpected missing columns: %#v", renamed)
	}
	if len(renamed.AddedColumns) != 1 || renamed.AddedColumns[0] != "Total" || renamed.Reordered {
		t.Fatalf("unexpected added columns: %#v", renamed)
	}

	reordered := CompareSchemas([]string{"Order", "Amount"}, []string{"Amount", "Order"})
	if !reordered.Reordered || len(reordered.MissingColumns) != 0 || len(reordered.AddedColumns) != 0 {
		t.Fatalf("unexpected reorder result: %#v", reordered)
	}
}
