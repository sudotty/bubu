import { describe, expect, it } from "vitest";
import {
  parseQueryPlanProposal,
  parseSafeQueryPlan,
  parseSafeQueryPlanText,
  parseSafeQueryResult,
} from "./query-plan.js";

const datasetId = "a".repeat(32);
const versionId = "b".repeat(32);
const plan = {
  schemaVersion: 1,
  datasetId,
  versionId,
  purpose: "按区域统计销售额",
  dimensions: ["Region"],
  measures: [{ operation: "sum", column: "Amount" }],
  filters: [{ column: "Status", operator: "equals", value: "paid" }],
  sort: [{ outputIndex: 1, direction: "descending" }],
  limit: 20,
} as const;

describe("safe query plan boundary", () => {
  it("accepts a bounded relational plan and strict JSON model output", () => {
    expect(parseSafeQueryPlan(plan)).toEqual(plan);
    expect(parseSafeQueryPlanText(JSON.stringify(plan))).toEqual(plan);
  });

  it("rejects raw SQL, unknown fields, invalid sort references, and code fences", () => {
    expect(() => parseSafeQueryPlan({ ...plan, sql: "DROP TABLE datasets" })).toThrow();
    expect(() => parseSafeQueryPlan({ ...plan, sort: [{ outputIndex: 9, direction: "ascending" }] })).toThrow();
    expect(() => parseSafeQueryPlanText(`\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``)).toThrow();
  });

  it("binds a proposal to exactly the context shown for approval", () => {
    const disclosedContext = {
      datasetId,
      versionId,
      disclosure: "schema-synthetic",
      columns: [
        { name: "Region", type: "text", nullable: false },
        { name: "Amount", type: "real", nullable: false },
      ],
      syntheticRows: [["example_1_1", 101.25], ["example_2_1", 102.25], ["example_3_1", 103.25]],
    } as const;
    expect(parseQueryPlanProposal({ question: "按区域统计", disclosedContext, plan })).toMatchObject({ plan });
    expect(() =>
      parseQueryPlanProposal({
        question: "按区域统计",
        disclosedContext,
        plan: { ...plan, versionId: "c".repeat(32) },
      }),
    ).toThrow("disclosed dataset version");
  });

  it("rejects malformed or oversized local results", () => {
    expect(
      parseSafeQueryResult({
        datasetId,
        versionId,
        columns: [{ label: "Region", type: "text" }],
        rows: [["North"]],
        truncated: false,
      }),
    ).toMatchObject({ rows: [["North"]] });
    expect(() =>
      parseSafeQueryResult({
        datasetId,
        versionId,
        columns: [{ label: "Region", type: "text" }],
        rows: [["North", "extra"]],
        truncated: false,
      }),
    ).toThrow("row width");
  });
});
