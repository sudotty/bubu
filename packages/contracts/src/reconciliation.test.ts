import { describe, expect, it } from "vitest";
import { parseComparisonPlan, parseReconciliationArtifact, parseReconciliationDefinition, parseReconciliationPlan, parseReconciliationProposal, parseReconciliationReplayEvent } from "./reconciliation.js";

const left = { datasetId: "a".repeat(32), versionId: "b".repeat(32) };
const right = { datasetId: "c".repeat(32), versionId: "d".repeat(32) };

const comparison = {
  schemaVersion: 1,
  purpose: "订单与付款核对",
  sources: { left, right },
  match: {
    keys: [
      { leftColumn: "Order ID", rightColumn: "Payment Order", normalization: ["trim", "case-fold"] },
      { leftColumn: "Region", rightColumn: "Region", normalization: ["trim"] },
    ],
    cardinality: "one-to-one",
    amountTolerance: { leftColumn: "Order Amount", rightColumn: "Paid Amount", absolute: 0.01 },
    dateTolerance: { leftColumn: "Order Date", rightColumn: "Paid Date", days: 2 },
  },
  budgets: { maximumCandidatePairs: 100_000, timeoutMs: 30_000 },
} as const;

describe("versioned comparison and reconciliation plans", () => {
  it("accepts reviewed composite exact matching with bounded tolerances", () => {
    expect(parseComparisonPlan(comparison)).toEqual(comparison);
    expect(parseReconciliationPlan({
      schemaVersion: 1,
      purpose: "订单付款对账",
      comparison,
      controlTotals: [
        { id: "gross", leftColumn: "Order Amount", rightColumn: "Paid Amount", aggregation: "sum", tolerance: 0.01 },
      ],
      unresolvedPolicy: "review-required",
    })).toMatchObject({ schemaVersion: 1, unresolvedPolicy: "review-required" });
  });

  it.each([
    ["arbitrary SQL", { ...comparison, sql: "select * from private" }],
    ["model code", { ...comparison, code: "return true" }],
    ["fuzzy matching", { ...comparison, match: { ...comparison.match, fuzzyThreshold: 0.8 } }],
    ["implicit many-to-many", { ...comparison, match: { ...comparison.match, cardinality: "many-to-many" } }],
    ["unbounded candidates", { ...comparison, budgets: { ...comparison.budgets, maximumCandidatePairs: 100_000_000 } }],
    ["negative money tolerance", { ...comparison, match: { ...comparison.match, amountTolerance: { ...comparison.match.amountTolerance, absolute: -1 } } }],
    ["unknown normalizer", { ...comparison, match: { ...comparison.match, keys: [{ leftColumn: "id", rightColumn: "id", normalization: ["phonetic"] }] } }],
  ])("rejects %s", (_label, value) => {
    expect(() => parseComparisonPlan(value)).toThrow();
  });

  it("requires immutable distinct source versions and explicit review policy", () => {
    expect(() => parseComparisonPlan({ ...comparison, sources: { left, right: left } })).toThrow();
    expect(() => parseReconciliationPlan({ schemaVersion: 1, purpose: "x", comparison, controlTotals: [], unresolvedPolicy: "auto-confirm" })).toThrow();
  });

  it("parses bounded approval and immutable artifact evidence", () => {
    const plan = { schemaVersion: 1 as const, purpose: "订单付款对账", comparison, controlTotals: [{ id: "gross", leftColumn: "Order Amount", rightColumn: "Paid Amount", aggregation: "sum" as const, tolerance: 0.01 }], unresolvedPolicy: "review-required" as const };
    const preview = {
      planFingerprint: "e".repeat(64),
      sources: [
        { side: "left", ...left, displayName: "订单", rowCount: 2, qualityScore: 100 },
        { side: "right", ...right, displayName: "付款", rowCount: 2, qualityScore: 95 },
      ],
      candidatePairs: 2,
      counts: { matched: 1, toleranceMatched: 0, leftUnmatched: 1, rightUnmatched: 1, leftDuplicate: 0, rightDuplicate: 0, conflict: 0, pending: 0 },
      controlTotals: [{ id: "gross", leftValue: 30, rightValue: 30, difference: 0, tolerance: 0.01, balanced: true }],
      limitations: ["仅执行规范化精确匹配；未决候选不会自动确认"],
    } as const;
    expect(parseReconciliationProposal({ approvalToken: "f".repeat(64), expiresAt: "2026-07-27T01:00:00.000Z", request: { plan }, preview })).toMatchObject({ preview: { candidatePairs: 2 } });
    expect(parseReconciliationArtifact({
      schemaVersion: 1, id: "1".repeat(32), createdAt: "2026-07-27T00:00:00.000Z", plan, ...preview,
      classifications: [{ category: "matched", leftRowNumber: 1, rightRowNumber: 1, key: "A", reason: "exact normalized match" }],
      completion: { status: "completed", classificationCount: 1, reviewKind: "one-use-approval", definitionId: null },
    })).toMatchObject({ completion: { status: "completed" } });
    expect(() => parseReconciliationArtifact({ schemaVersion: 1, id: "1".repeat(32), createdAt: "2026-07-27T00:00:00.000Z", plan, ...preview, classifications: [], completion: { status: "partial", classificationCount: 0, reviewKind: "one-use-approval", definitionId: null } })).toThrow();
  });

  it("parses reviewed definitions and fail-closed replay states", () => {
    const plan = { schemaVersion: 1 as const, purpose: "订单付款对账", comparison, controlTotals: [{ id: "gross", leftColumn: "Order Amount", rightColumn: "Paid Amount", aggregation: "sum" as const, tolerance: 0.01 }], unresolvedPolicy: "review-required" as const };
    expect(parseReconciliationDefinition({ schemaVersion: 1, id: "1".repeat(32), plan, planFingerprint: "e".repeat(64), active: true, lastArtifactId: "2".repeat(32), createdAt: "2026-07-27T00:00:00Z", updatedAt: "2026-07-27T00:00:00Z" })).toMatchObject({ active: true });
    const paused = { schemaVersion: 1, id: "1".repeat(32), definitionId: "2".repeat(32), triggerDatasetId: left.datasetId, triggerVersionId: left.versionId, status: "paused", reasonKind: "cardinality-change", error: "Reviewed cardinality changed", artifactId: null, attempt: 1, createdAt: "2026-07-27T00:00:00Z", startedAt: "2026-07-27T00:00:01Z", finishedAt: "2026-07-27T00:00:02Z" } as const;
    expect(parseReconciliationReplayEvent(paused)).toMatchObject({ status: "paused", reasonKind: "cardinality-change" });
    expect(() => parseReconciliationReplayEvent({ ...paused, status: "succeeded", reasonKind: "silently-accepted" })).toThrow();
    expect(() => parseReconciliationReplayEvent({ ...paused, attempt: 4 })).toThrow();
  });
});
