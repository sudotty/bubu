import { describe, expect, it } from "vitest";
import type {
  SafeGroupQueryPlan,
  SafeGroupQueryResult,
  SafeQueryPlan,
  SafeQueryResult,
} from "@bubu/contracts";
import { deriveGroupAggregateDisclosure, deriveAggregateDisclosure } from "./aggregate-disclosure.js";

const datasetId = "a".repeat(32);
const versionId = "b".repeat(32);
const plan: SafeQueryPlan = {
  schemaVersion: 1,
  datasetId,
  versionId,
  purpose: "Revenue by region",
  dimensions: ["Region"],
  measures: [
    { operation: "sum", column: "Amount" },
    { operation: "count", column: null },
  ],
  filters: [],
  sort: [{ outputIndex: 1, direction: "descending" }],
  limit: 200,
};
const result: SafeQueryResult = {
  datasetId,
  versionId,
  columns: [
    { label: "Region", type: "text" },
    { label: "sum(Amount)", type: "real" },
    { label: "count(*)", type: "integer" },
  ],
  rows: [["North", 100, 8], ["South", 80, 5]],
  truncated: false,
};

describe("aggregate disclosure policy", () => {
  it("derives only the exact aggregate cells from an immutable dataset result", () => {
    expect(deriveAggregateDisclosure("Explain this", plan, result)).toEqual({
      schemaVersion: 1,
      target: { kind: "dataset", id: datasetId },
      question: "Explain this",
      purpose: plan.purpose,
      sourceCount: 1,
      columns: result.columns,
      rows: result.rows,
      truncated: false,
      minimumGroupSize: 5,
    });
  });

  it("requires COUNT(*) >= 5 and rejects extrema or identity drift", () => {
    expect(() => deriveAggregateDisclosure("Explain", {
      ...plan,
      measures: [{ operation: "sum", column: "Amount" }],
    }, result)).toThrow("COUNT(*)");
    expect(() => deriveAggregateDisclosure("Explain", {
      ...plan,
      measures: [...plan.measures, { operation: "maximum", column: "Amount" }],
    }, result)).toThrow("minimum or maximum");
    expect(() => deriveAggregateDisclosure("Explain", plan, {
      ...result,
      rows: [["North", 100, 4]],
    })).toThrow("at least 5");
    expect(() => deriveAggregateDisclosure("Explain", plan, {
      ...result,
      versionId: "c".repeat(32),
    })).toThrow("immutable version");
  });

  it("caps disclosure at 50 rows and reports that local results remain", () => {
    const rows = Array.from({ length: 60 }, (_, index) => [`Region ${index}`, index, 5]);
    const disclosure = deriveAggregateDisclosure("Explain", plan, { ...result, rows });
    expect(disclosure.rows).toHaveLength(50);
    expect(disclosure.truncated).toBe(true);
  });

  it("preserves the ordered immutable source identities for group results", () => {
    const sourceVersions = [
      { datasetId, versionId },
      { datasetId: "d".repeat(32), versionId: "e".repeat(32) },
    ];
    const groupPlan: SafeGroupQueryPlan = {
      schemaVersion: 1,
      groupId: "f".repeat(32),
      purpose: "Revenue by segment",
      sources: sourceVersions,
      joins: [{
        leftSourceIndex: 0, leftColumn: "Segment ID",
        rightSourceIndex: 1, rightColumn: "Segment ID", type: "left",
      }],
      dimensions: [{ sourceIndex: 1, column: "Segment" }],
      measures: [
        { operation: "sum", sourceIndex: 0, column: "Amount" },
        { operation: "count", sourceIndex: 0, column: null },
      ],
      filters: [], sort: [], limit: 50,
    };
    const groupResult: SafeGroupQueryResult = {
      groupId: groupPlan.groupId,
      sourceVersions,
      columns: result.columns,
      rows: result.rows,
      truncated: false,
    };
    expect(deriveGroupAggregateDisclosure("Explain group", groupPlan, groupResult)).toMatchObject({
      target: { kind: "group", id: groupPlan.groupId },
      sourceCount: 2,
    });
    expect(() => deriveGroupAggregateDisclosure("Explain group", groupPlan, {
      ...groupResult,
      sourceVersions: [...sourceVersions].reverse(),
    })).toThrow("immutable sources");
  });
});
