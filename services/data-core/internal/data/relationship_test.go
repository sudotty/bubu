package data

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestRelationshipDiscoveryPersistenceAndCurrentVersionValidation(t *testing.T) {
	root := t.TempDir()
	ordersPath := filepath.Join(root, "orders.csv")
	regionsPath := filepath.Join(root, "regions.csv")
	changedRegionsPath := filepath.Join(root, "regions-changed.csv")
	if err := os.WriteFile(ordersPath, []byte("Order,Region\nA-1,North\nA-2,North\nA-3,South\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(regionsPath, []byte("Region,Manager\nNorth,Lin\nSouth,Chen\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(changedRegionsPath, []byte("Region,Manager\nNorth,Lin\nNorth,Wu\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	orders, err := service.ImportFile(context.Background(), ordersPath)
	if err != nil {
		t.Fatal(err)
	}
	regions, err := service.ImportFile(context.Background(), regionsPath)
	if err != nil {
		t.Fatal(err)
	}
	group, err := service.SaveGroup(context.Background(), "", "Orders and regions", []string{
		orders.Datasets[0].ID,
		regions.Datasets[0].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	overview, err := service.GetGroupRelationships(context.Background(), group.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(overview.Candidates) != 1 {
		t.Fatalf("expected one directional lookup candidate: %#v", overview)
	}
	candidate := overview.Candidates[0]
	if candidate.Left.DatasetID != orders.Datasets[0].ID || candidate.Right.DatasetID != regions.Datasets[0].ID {
		t.Fatalf("relationship direction is unsafe: %#v", candidate)
	}
	saved, err := service.SaveRelationship(context.Background(), DatasetRelationshipSaveInput{
		Left: candidate.Left, Right: candidate.Right,
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != "ready" || saved.Issue != nil {
		t.Fatalf("new relationship is not ready: %#v", saved)
	}
	overview, err = service.GetGroupRelationships(context.Background(), group.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(overview.Relationships) != 1 || len(overview.Candidates) != 0 {
		t.Fatalf("saved relationship was not reused: %#v", overview)
	}

	if _, err := service.ReplaceFile(context.Background(), regions.Datasets[0].ID, changedRegionsPath); err != nil {
		t.Fatal(err)
	}
	overview, err = service.GetGroupRelationships(context.Background(), group.ID)
	if err != nil {
		t.Fatal(err)
	}
	if overview.Relationships[0].Status != "invalid" || overview.Relationships[0].Issue == nil || *overview.Relationships[0].Issue != "right-not-unique" {
		t.Fatalf("relationship did not detect current-version key drift: %#v", overview.Relationships)
	}
	if err := service.DeleteRelationship(context.Background(), saved.ID); err != nil {
		t.Fatal(err)
	}
	overview, err = service.GetGroupRelationships(context.Background(), group.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(overview.Relationships) != 0 {
		t.Fatalf("relationship deletion was not durable: %#v", overview.Relationships)
	}
}

func TestRelationshipRejectsANonUniqueRightKey(t *testing.T) {
	root := t.TempDir()
	leftPath := filepath.Join(root, "left.csv")
	rightPath := filepath.Join(root, "right.csv")
	if err := os.WriteFile(leftPath, []byte("Key\nA\nB\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(rightPath, []byte("Key\nA\nA\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := openTestService(t, filepath.Join(root, "data"))
	left, err := service.ImportFile(context.Background(), leftPath)
	if err != nil {
		t.Fatal(err)
	}
	right, err := service.ImportFile(context.Background(), rightPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.SaveRelationship(context.Background(), DatasetRelationshipSaveInput{
		Left:  RelationshipEndpoint{DatasetID: left.Datasets[0].ID, Column: "Key"},
		Right: RelationshipEndpoint{DatasetID: right.Datasets[0].ID, Column: "Key"},
	})
	if err == nil {
		t.Fatal("non-unique right lookup key was accepted")
	}
}
