import { describe, expect, it } from "vitest";
import { parseGroupQueryPlanProposal, parseSafeGroupQueryPlan } from "./group-query-plan.js";

const source = (dataset: string, version: string) => ({ datasetId: dataset.repeat(32), versionId: version.repeat(32) });
const sources = [source("a", "c"), source("b", "d")];
const plan = {
  schemaVersion: 1,
  groupId: "e".repeat(32),
  purpose: "按类别统计订单数",
  sources,
  joins: [{ leftSourceIndex: 0, leftColumn: "Product ID", rightSourceIndex: 1, rightColumn: "Product ID", type: "left" }],
  dimensions: [{ sourceIndex: 1, column: "Category" }],
  measures: [{ operation: "count", sourceIndex: 0, column: "Order ID" }],
  filters: [],
  sort: [{ outputIndex: 1, direction: "descending" }],
  limit: 50,
} as const;

describe("safe group query plan", () => {
  it("accepts a connected bounded join tree", () => {
    expect(parseSafeGroupQueryPlan(plan)).toEqual(plan);
  });

  it("rejects skipped sources, cycles, cross joins, raw SQL, and invalid references", () => {
    expect(() => parseSafeGroupQueryPlan({ ...plan, joins: [] })).toThrow("additional source");
    expect(() => parseSafeGroupQueryPlan({ ...plan, joins: [{ ...plan.joins[0], rightSourceIndex: 0 }] })).toThrow("connected tree");
    expect(() => parseSafeGroupQueryPlan({ ...plan, sql: "SELECT *" })).toThrow();
    expect(() => parseSafeGroupQueryPlan({ ...plan, dimensions: [{ sourceIndex: 7, column: "Category" }] })).toThrow("declared source");
  });

  it("binds the plan to every context disclosed in member order", () => {
    const disclosedContexts = sources.map((item, index) => ({
      ...item,
      disclosure: "schema-synthetic" as const,
      columns: [{ name: index === 0 ? "Order ID" : "Category", type: "text" as const, nullable: false, unique: index === 0 }],
      syntheticRows: [["synthetic_1"], ["synthetic_2"], ["synthetic_3"]],
    }));
    expect(parseGroupQueryPlanProposal({ question: "统计", disclosedContexts, plan })).toMatchObject({ plan });
    expect(() => parseGroupQueryPlanProposal({ question: "统计", disclosedContexts: [...disclosedContexts].reverse(), plan })).toThrow("exactly match");
  });
});
