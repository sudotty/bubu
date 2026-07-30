import { describe, expect, it } from "vitest";
import type { WorkflowApprovalRequest } from "@bubu/contracts";
import { expireWorkflowApproval, resolveWorkflowApproval, workflowApprovalFacts } from "./workflow-approval.js";

const approval: WorkflowApprovalRequest = {
  schemaVersion: 1,
  id: "a".repeat(32), workflowId: "b".repeat(32), definitionVersion: 2, runId: "c".repeat(32),
  stepId: "review", ordinal: 1, target: { kind: "dataset", id: "d".repeat(32) },
  title: "确认结果", action: "继续交付", risk: "medium", status: "pending",
  requestedAt: "2026-07-29T00:00:00Z", expiresAt: "2026-07-29T01:00:00Z", decidedAt: null, decisionNote: null,
};

describe("workflow approval policy", () => {
  it("resumes only the same definition and target before expiry", () => {
    const resolved = resolveWorkflowApproval(approval, { approvalId: approval.id, decision: "approved", note: "已核对" }, {
      now: "2026-07-29T00:30:00Z", currentDefinitionVersion: 2, target: approval.target,
    });
    expect(resolved.status).toBe("approved");
    expect(resolved.decisionNote).toBe("已核对");
    expect(() => resolveWorkflowApproval(approval, { approvalId: approval.id, decision: "approved" }, {
      now: "2026-07-29T00:30:00Z", currentDefinitionVersion: 3, target: approval.target,
    })).toThrow("definition");
    expect(() => resolveWorkflowApproval(approval, { approvalId: approval.id, decision: "approved" }, {
      now: "2026-07-29T01:00:00Z", currentDefinitionVersion: 2, target: approval.target,
    })).toThrow("expired");
  });

  it("expires without broadening the stored approval and exposes content-free facts", () => {
    expect(expireWorkflowApproval(approval, "2026-07-29T00:59:59Z")).toBe(approval);
    expect(expireWorkflowApproval(approval, "2026-07-29T01:00:00Z").status).toBe("expired");
    expect(workflowApprovalFacts(approval, "2026-07-29T00:30:00Z")).toEqual({
      workflowId: approval.workflowId, runId: approval.runId, stepId: "review", definitionVersion: 2,
      targetKind: "dataset", risk: "medium", minutesRemaining: 30, canDecide: true,
    });
  });
});
