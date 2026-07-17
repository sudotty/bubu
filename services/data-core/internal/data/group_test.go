package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDatasetGroupLifecycleUsesCurrentImmutableMembers(t *testing.T) {
	root := t.TempDir()
	sales := filepath.Join(root, "sales.csv")
	targets := filepath.Join(root, "targets.csv")
	replacement := filepath.Join(root, "sales-next.csv")
	for path, contents := range map[string]string{
		sales:       "Region,Amount\nNorth,10\n",
		targets:     "Region,Target\nNorth,20\n",
		replacement: "Region,Amount\nNorth,15\nSouth,30\n",
	} {
		if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFiles(context.Background(), []string{sales, targets})
	if err != nil {
		t.Fatal(err)
	}
	group, err := service.SaveGroup(context.Background(), "", "区域经营群", []string{
		imported.Datasets[0].ID,
		imported.Datasets[1].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if group.Name != "区域经营群" || len(group.Members) != 2 {
		t.Fatalf("unexpected created group: %#v", group)
	}
	if _, err := service.ReplaceFile(context.Background(), imported.Datasets[0].ID, replacement); err != nil {
		t.Fatal(err)
	}
	groups, err := service.ListGroups(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || groups[0].Members[0].Version != 2 || groups[0].Members[0].RowCount != 2 {
		t.Fatalf("group did not resolve the current immutable member: %#v", groups)
	}
	updated, err := service.SaveGroup(context.Background(), group.ID, "经营对比群", []string{
		imported.Datasets[1].ID,
		imported.Datasets[0].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "经营对比群" || updated.Members[0].ID != imported.Datasets[1].ID {
		t.Fatalf("group update did not preserve order: %#v", updated)
	}
	if err := service.DeleteGroup(context.Background(), group.ID); err != nil {
		t.Fatal(err)
	}
	groups, err = service.ListGroups(context.Background())
	if err != nil || len(groups) != 0 {
		t.Fatalf("group deletion failed: %#v, %v", groups, err)
	}
}

func TestDatasetGroupRejectsInvalidMembership(t *testing.T) {
	service := openTestService(t, filepath.Join(t.TempDir(), "data"))
	missing := strings.Repeat("f", 32)
	if _, err := service.SaveGroup(context.Background(), "", "Invalid", []string{missing}); err == nil || !strings.Contains(err.Error(), "between") {
		t.Fatalf("expected minimum membership error, got %v", err)
	}
	if _, err := service.SaveGroup(context.Background(), "", "Invalid", []string{missing, missing}); err == nil || !strings.Contains(err.Error(), "duplicated") {
		t.Fatalf("expected duplicate membership error, got %v", err)
	}
}
