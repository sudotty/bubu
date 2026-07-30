import { describe, expect, it, vi } from "vitest";
import type { ReconciliationPlan, ReconciliationPreview } from "@bubu/contracts";
import { createReconciliationApprovalSessionStore } from "./reconciliation-approval-sessions.js";

const plan = { schemaVersion: 1, purpose: "对账", comparison: { schemaVersion: 1, purpose: "比较", sources: { left: { datasetId: "a".repeat(32), versionId: "b".repeat(32) }, right: { datasetId: "c".repeat(32), versionId: "d".repeat(32) } }, match: { keys: [{ leftColumn: "id", rightColumn: "id", normalization: ["trim"] }], cardinality: "one-to-one" }, budgets: { maximumCandidatePairs: 100, timeoutMs: 1000 } }, controlTotals: [{ id: "gross", leftColumn: "amount", rightColumn: "paid", aggregation: "sum", tolerance: .01 }], unresolvedPolicy: "review-required" } as const satisfies ReconciliationPlan;
const preview = { planFingerprint: "e".repeat(64), sources: [{ side: "left", datasetId: "a".repeat(32), versionId: "b".repeat(32), displayName: "订单", rowCount: 1, qualityScore: 100 }, { side: "right", datasetId: "c".repeat(32), versionId: "d".repeat(32), displayName: "付款", rowCount: 1, qualityScore: 100 }], candidatePairs: 1, counts: { matched: 1, toleranceMatched: 0, leftUnmatched: 0, rightUnmatched: 0, leftDuplicate: 0, rightDuplicate: 0, conflict: 0, pending: 0 }, controlTotals: [{ id: "gross", leftValue: 1, rightValue: 1, difference: 0, tolerance: .01, balanced: true }], limitations: ["未决候选不会自动确认"] } as const satisfies ReconciliationPreview;

describe("reconciliation approval sessions", () => {
  it("binds and consumes one exact reviewed plan once", () => {
    const store = createReconciliationApprovalSessionStore({ now: () => Date.parse("2026-07-27T00:00:00Z"), newToken: () => "f".repeat(64) });
    const proposal = store.issue({ plan }, preview);
    expect(proposal.preview.planFingerprint).toBe(preview.planFingerprint);
    expect(store.consume(proposal.approvalToken)).toMatchObject({ request: { plan }, preview });
    expect(() => store.consume(proposal.approvalToken)).toThrow(/already been used/u);
  });

  it("rejects expired and revoked approvals", () => {
    let now = Date.parse("2026-07-27T00:00:00Z");
    const store = createReconciliationApprovalSessionStore({ now: () => now, newToken: vi.fn(() => "f".repeat(64)) });
    const expired = store.issue({ plan }, preview); now += 11 * 60_000;
    expect(() => store.consume(expired.approvalToken)).toThrow(/expired/u);
    now = Date.parse("2026-07-27T00:00:00Z"); const revoked = store.issue({ plan }, preview); store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow();
  });
});
