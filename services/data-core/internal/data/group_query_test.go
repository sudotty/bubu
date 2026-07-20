package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func importGroupQueryFixture(t *testing.T) (*Service, DatasetGroup) {
	t.Helper()
	root := t.TempDir()
	orders := filepath.Join(root, "orders.csv")
	products := filepath.Join(root, "products.csv")
	if err := os.WriteFile(orders, []byte("Order ID,Product ID,Quantity\nO-1,P-1,2\nO-2,P-2,1\nO-3,P-1,3\nO-4,P-X,1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(products, []byte("Product ID,Category\nP-1,Electronics\nP-2,Books\nP-3,Electronics\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	imported, err := service.ImportFiles(context.Background(), []string{orders, products})
	if err != nil {
		t.Fatal(err)
	}
	group, err := service.SaveGroup(context.Background(), "", "Orders and products", "", "one-off", []string{
		imported.Datasets[0].ID,
		imported.Datasets[1].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	return service, group
}

func baseGroupQueryPlan(group DatasetGroup) SafeGroupQueryPlan {
	return SafeGroupQueryPlan{
		SchemaVersion: 1,
		GroupID:       group.ID,
		Purpose:       "Look up product categories",
		Sources: []GroupQuerySource{
			{DatasetID: group.Members[0].ID, VersionID: group.Members[0].VersionID},
			{DatasetID: group.Members[1].ID, VersionID: group.Members[1].VersionID},
		},
		Joins: []GroupQueryJoin{{
			LeftSourceIndex: 0, LeftColumn: "Product ID",
			RightSourceIndex: 1, RightColumn: "Product ID", Type: "left",
		}},
		Dimensions: []GroupQueryColumnRef{
			{SourceIndex: 0, Column: "Order ID"},
			{SourceIndex: 1, Column: "Category"},
		},
		Measures: []GroupQueryMeasure{},
		Filters:  []GroupQueryFilter{},
		Sort:     []QuerySort{},
		Limit:    20,
	}
}

func TestExecuteGroupQueryPlanPerformsBoundedLeftLookup(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	result, err := service.ExecuteGroupQueryPlan(context.Background(), baseGroupQueryPlan(group))
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 4 || result.Rows[0][0] != "O-1" || result.Rows[0][1] != "Electronics" || result.Rows[3][1] != nil {
		t.Fatalf("unexpected group lookup result: %#v", result)
	}
	if result.Columns[1].Label != "Source 2 · Category" {
		t.Fatalf("unexpected group result label: %#v", result.Columns)
	}
}

func TestExecuteGroupQueryPlanAggregatesAfterJoin(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	plan := baseGroupQueryPlan(group)
	plan.Dimensions = []GroupQueryColumnRef{{SourceIndex: 1, Column: "Category"}}
	plan.Measures = []GroupQueryMeasure{{Operation: "count", SourceIndex: 0, Column: text("Order ID")}}
	plan.Sort = []QuerySort{{OutputIndex: 1, Direction: "descending"}}
	result, err := service.ExecuteGroupQueryPlan(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 3 || result.Rows[0][0] != "Electronics" || result.Rows[0][1] != int64(2) {
		t.Fatalf("unexpected joined aggregate: %#v", result.Rows)
	}
}

func TestExecuteGroupQueryPlanRejectsStaleAndDisconnectedPlans(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	stale := baseGroupQueryPlan(group)
	stale.Sources[1].VersionID = strings.Repeat("f", 32)
	if _, err := service.ExecuteGroupQueryPlan(context.Background(), stale); err == nil || !strings.Contains(err.Error(), "stale") {
		t.Fatalf("expected stale source rejection, got %v", err)
	}
	disconnected := baseGroupQueryPlan(group)
	disconnected.Joins[0].RightSourceIndex = 0
	if _, err := service.ExecuteGroupQueryPlan(context.Background(), disconnected); err == nil || !strings.Contains(err.Error(), "connected tree") {
		t.Fatalf("expected disconnected join rejection, got %v", err)
	}
	nonUnique := baseGroupQueryPlan(group)
	nonUnique.Joins[0].RightColumn = "Category"
	if _, err := service.ExecuteGroupQueryPlan(context.Background(), nonUnique); err == nil || !strings.Contains(err.Error(), "non-null and unique") {
		t.Fatalf("expected non-unique lookup rejection, got %v", err)
	}
}

func TestExecuteGroupQueryPlanBindsHostileValues(t *testing.T) {
	service, group := importGroupQueryFixture(t)
	plan := baseGroupQueryPlan(group)
	hostile := "Electronics' OR 1=1 --"
	plan.Filters = []GroupQueryFilter{{
		SourceIndex: 1, Column: "Category", Operator: "equals", Value: &hostile,
	}}
	result, err := service.ExecuteGroupQueryPlan(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 0 {
		t.Fatalf("hostile group filter escaped binding: %#v", result.Rows)
	}
	groups, err := service.ListGroups(context.Background())
	if err != nil || len(groups) != 1 {
		t.Fatalf("group catalog changed after hostile filter: %#v, %v", groups, err)
	}
}
