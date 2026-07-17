import { describe, expect, it } from "vitest";
import type { ConversationThread, SafeQueryPlan, SafeQueryResult } from "@bubu/contracts";
import { findReviewedAggregateSource } from "./conversation-plan.js";

const plan: SafeQueryPlan = {
  schemaVersion: 1,
  datasetId: "a".repeat(32),
  versionId: "b".repeat(32),
  purpose: "Count by region",
  dimensions: ["Region"],
  measures: [{ operation: "count", column: null }],
  filters: [], sort: [], limit: 50,
};
const result: SafeQueryResult = {
  datasetId: plan.datasetId,
  versionId: plan.versionId,
  columns: [{ label: "Region", type: "text" }, { label: "count(*)", type: "integer" }],
  rows: [["North", 8]],
  truncated: false,
};

function thread(sourcePlan: SafeQueryPlan): ConversationThread {
  return {
    entries: [
      { kind: "plan", payload: { proposal: { question: "Explain regions", plan } } },
      { kind: "result", payload: { result, sourcePlan } },
    ],
  } as unknown as ConversationThread;
}

describe("reviewed conversation plans", () => {
  it("returns only a persisted result explicitly linked to the reviewed plan", () => {
    expect(findReviewedAggregateSource(thread(plan), plan)).toEqual({
      question: "Explain regions",
      result,
    });
    expect(findReviewedAggregateSource(thread({ ...plan, purpose: "Different" }), plan)).toBeNull();
  });
});
