package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
)

const maximumDerivedDependencyNodes = 500
const maximumDerivedDependencyEdges = 5_000

func (service *Service) GetDerivedDependencyPlan(ctx context.Context, sourceDatasetID string) (DerivedDependencyPlan, error) {
	return getDerivedDependencyPlan(ctx, service.database, sourceDatasetID)
}

type derivedDependencyQuerier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func getDerivedDependencyPlan(ctx context.Context, query derivedDependencyQuerier, sourceDatasetID string) (DerivedDependencyPlan, error) {
	if !objectID.MatchString(sourceDatasetID) {
		return DerivedDependencyPlan{}, errors.New("source dataset id is invalid")
	}
	var exists int
	if err := query.QueryRowContext(ctx, "SELECT 1 FROM datasets WHERE id = ?", sourceDatasetID).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
		return DerivedDependencyPlan{}, errors.New("source dataset was not found")
	} else if err != nil {
		return DerivedDependencyPlan{}, fmt.Errorf("load dependency source: %w", err)
	}
	rows, err := query.QueryContext(ctx, `
SELECT parents.parent_dataset_id, lineages.dataset_id
FROM derived_dataset_lineages lineages
JOIN datasets derived ON derived.id = lineages.dataset_id AND derived.current_version_id = lineages.version_id
JOIN derived_dataset_lineage_parents parents ON parents.derived_version_id = lineages.version_id
ORDER BY parents.parent_dataset_id, lineages.dataset_id`)
	if err != nil {
		return DerivedDependencyPlan{}, fmt.Errorf("load derived dependency edges: %w", err)
	}
	defer rows.Close()
	adjacency := make(map[string][]string)
	edgeCount := 0
	for rows.Next() {
		var parent, child string
		if err := rows.Scan(&parent, &child); err != nil {
			return DerivedDependencyPlan{}, fmt.Errorf("scan derived dependency edge: %w", err)
		}
		edgeCount++
		if edgeCount > maximumDerivedDependencyEdges {
			return DerivedDependencyPlan{}, errors.New("derived dependency graph exceeds its edge budget")
		}
		if !slices.Contains(adjacency[parent], child) {
			adjacency[parent] = append(adjacency[parent], child)
		}
	}
	if err := rows.Err(); err != nil {
		return DerivedDependencyPlan{}, fmt.Errorf("iterate derived dependency edges: %w", err)
	}
	colors := make(map[string]uint8)
	postorder := make([]string, 0)
	var visit func(string) error
	visit = func(node string) error {
		if colors[node] == 1 {
			return errors.New("derived dependency graph contains a cycle")
		}
		if colors[node] == 2 {
			return nil
		}
		colors[node] = 1
		children := slices.Clone(adjacency[node])
		slices.Sort(children)
		for _, child := range children {
			if err := visit(child); err != nil {
				return err
			}
		}
		colors[node] = 2
		if node != sourceDatasetID {
			postorder = append(postorder, node)
		}
		if len(colors) > maximumDerivedDependencyNodes {
			return errors.New("derived dependency graph exceeds its node budget")
		}
		return nil
	}
	if err := visit(sourceDatasetID); err != nil {
		return DerivedDependencyPlan{}, err
	}
	slices.Reverse(postorder)
	return DerivedDependencyPlan{SourceDatasetID: sourceDatasetID, OrderedDatasetIDs: postorder, EdgeCount: edgeCount}, nil
}
