import { describe, expect, it } from "vitest";
import type { DataCleanImpactPreview, DataCleanPreviewRequest, DataCleanQualityEvidence } from "@bubu/contracts";
import { createDataCleanApprovalSessionStore } from "./data-clean-approval-sessions.js";

const request: DataCleanPreviewRequest = {
  displayName: "已清理订单",
  cleanPlan: { schemaVersion: 1, purpose: "订单去重", sources: [{ datasetId: "a".repeat(32), versionId: "b".repeat(32) }], operations: [{ kind: "deduplicate", keys: ["订单号"], keep: "first" }] },
  qualityPolicy: { schemaVersion: 1, rules: [{ id: "output-has-rows", severity: "blocking", kind: "row-count", minimum: 1 }] },
};
const quality: DataCleanQualityEvidence = { policyFingerprint: "f".repeat(64), status: "passed", results: [{ ruleId: "output-has-rows", severity: "blocking", kind: "row-count", passed: true, failedRows: 0, observed: "2 rows", expected: "at least 1", sampleRowNumbers: [] }] };
const impact: DataCleanImpactPreview = {
  planFingerprint: "c".repeat(64),
  sources: [{ datasetId: "a".repeat(32), versionId: "b".repeat(32), displayName: "订单", rowCount: 3, columns: ["订单号"] }],
  resultRowCount: 2,
  resultColumns: ["订单号"],
  operations: [{ ordinal: 1, kind: "deduplicate", beforeRowCount: 3, afterRowCount: 2, beforeColumnCount: 1, afterColumnCount: 1, beforeColumns: ["订单号"], afterColumns: ["订单号"], affectedRowCount: 1 }],
};

describe("data-clean approval sessions", () => {
  it("binds the exact reviewed request and consumes it once", () => {
    const store = createDataCleanApprovalSessionStore({ now: () => 1_000, newToken: () => "d".repeat(64) });
    const proposal = store.issue(request, impact, quality);
    expect(proposal).toMatchObject({ request, impact, quality });
    expect(store.consume(proposal.approvalToken)).toEqual({ request, impact, quality, reviewedAt: "1970-01-01T00:00:01.000Z" });
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("expires and revokes unused reviews", () => {
    let now = 1_000;
    const store = createDataCleanApprovalSessionStore({ now: () => now, newToken: () => "e".repeat(64) });
    const expired = store.issue(request, impact, quality);
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(expired.approvalToken)).toThrow("expired or has already been used");
    const revoked = store.issue(request, impact, quality);
    store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow("expired or has already been used");
  });
});
