package data

import "strings"

func discoverRelationshipCandidates(
	group DatasetGroup,
	targets map[string]qualityTarget,
	saved map[string]struct{},
) []RelationshipCandidate {
	result := make([]RelationshipCandidate, 0)
	for leftIndex, leftMember := range group.Members {
		left := targets[leftMember.ID]
		for rightIndex := leftIndex + 1; rightIndex < len(group.Members); rightIndex++ {
			rightMember := group.Members[rightIndex]
			right := targets[rightMember.ID]
			for _, leftColumn := range left.columns {
				for _, rightColumn := range right.columns {
					if !strings.EqualFold(leftColumn.Name, rightColumn.Name) ||
						!relationshipTypesCompatible(leftColumn.InferredType, rightColumn.InferredType) ||
						right.rowCount == 0 || rightColumn.NullCount != 0 || rightColumn.DistinctCount != right.rowCount {
						continue
					}
					leftEndpoint := RelationshipEndpoint{DatasetID: left.datasetID, Column: leftColumn.Name}
					rightEndpoint := RelationshipEndpoint{DatasetID: right.datasetID, Column: rightColumn.Name}
					if _, exists := saved[relationshipKey(leftEndpoint, rightEndpoint)]; exists {
						continue
					}
					result = append(result, RelationshipCandidate{
						Left: leftEndpoint, Right: rightEndpoint, Reason: "same-name-unique-right",
					})
					if len(result) == maximumRelationshipCandidates {
						return result
					}
				}
			}
		}
	}
	return result
}

func relationshipIssue(
	input DatasetRelationshipSaveInput,
	left qualityTarget,
	right qualityTarget,
) *string {
	leftColumn, leftFound := findRelationshipColumn(left, input.Left.Column)
	rightColumn, rightFound := findRelationshipColumn(right, input.Right.Column)
	if !leftFound || !rightFound {
		return relationshipIssueValue("missing-column")
	}
	if !relationshipTypesCompatible(leftColumn.InferredType, rightColumn.InferredType) {
		return relationshipIssueValue("type-mismatch")
	}
	if right.rowCount == 0 || rightColumn.NullCount != 0 || rightColumn.DistinctCount != right.rowCount {
		return relationshipIssueValue("right-not-unique")
	}
	return nil
}

func findRelationshipColumn(target qualityTarget, name string) (ColumnProfile, bool) {
	for _, column := range target.columns {
		if column.Name == name {
			return column, true
		}
	}
	return ColumnProfile{}, false
}

func relationshipTypesCompatible(left, right ColumnType) bool {
	if left == right {
		return true
	}
	leftNumeric := left == ColumnTypeInteger || left == ColumnTypeReal
	rightNumeric := right == ColumnTypeInteger || right == ColumnTypeReal
	return leftNumeric && rightNumeric
}

func relationshipIssueValue(value string) *string {
	return &value
}

func relationshipKey(left, right RelationshipEndpoint) string {
	return left.DatasetID + "\x00" + left.Column + "\x00" + right.DatasetID + "\x00" + right.Column
}
