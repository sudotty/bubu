import { describe, expect, it } from "vitest";
import {
  parseDatasetRelationshipSaveInput,
  parseGroupRelationshipOverview,
} from "./relationship.js";

const left = { datasetId: "a".repeat(32), column: "Region" };
const right = { datasetId: "b".repeat(32), column: "Region" };

describe("reusable dataset relationships", () => {
  it("requires a directional relationship between distinct datasets", () => {
    expect(parseDatasetRelationshipSaveInput({ left, right })).toEqual({ left, right });
    expect(() => parseDatasetRelationshipSaveInput({ left, right: left })).toThrow();
    expect(() => parseDatasetRelationshipSaveInput({ left, right, sql: "CROSS JOIN" })).toThrow();
  });

  it("distinguishes ready saved relationships from current-version issues", () => {
    const overview = {
      groupId: "c".repeat(32),
      relationships: [{
        id: "d".repeat(32),
        kind: "lookup",
        left,
        right,
        status: "ready",
        issue: null,
        createdAt: "2026-07-17T10:00:00Z",
      }],
      candidates: [{ left, right, reason: "same-name-unique-right" }],
    } as const;
    expect(parseGroupRelationshipOverview(overview)).toEqual(overview);
    expect(() => parseGroupRelationshipOverview({
      ...overview,
      relationships: [{ ...overview.relationships[0], status: "invalid", issue: null }],
    })).toThrow();
  });
});
