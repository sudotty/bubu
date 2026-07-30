import {
  parseWorkflowApprovalDecisionInput,
  parseWorkflowApprovalRequest,
  type WorkflowApprovalDecisionInput,
  type WorkflowApprovalRequest,
  type WorkflowTarget,
} from "@bubu/contracts";

interface ApprovalContext {
  readonly now: string;
  readonly currentDefinitionVersion: number;
  readonly target: WorkflowTarget;
}

export function expireWorkflowApproval(approval: WorkflowApprovalRequest, now: string): WorkflowApprovalRequest {
  if (approval.status !== "pending" || Date.parse(now) < Date.parse(approval.expiresAt)) return approval;
  return parseWorkflowApprovalRequest({ ...approval, status: "expired", decidedAt: now, decisionNote: null });
}

export function resolveWorkflowApproval(
  approval: WorkflowApprovalRequest,
  decisionValue: WorkflowApprovalDecisionInput,
  context: ApprovalContext,
): WorkflowApprovalRequest {
  const decision = parseWorkflowApprovalDecisionInput(decisionValue);
  if (approval.id !== decision.approvalId || approval.status !== "pending") throw new Error("Workflow approval is not pending");
  if (approval.definitionVersion !== context.currentDefinitionVersion) throw new Error("Workflow definition changed after approval was requested");
  if (approval.target.kind !== context.target.kind || approval.target.id !== context.target.id) throw new Error("Workflow approval target changed");
  if (Date.parse(context.now) >= Date.parse(approval.expiresAt)) throw new Error("Workflow approval expired");
  return parseWorkflowApprovalRequest({
    ...approval,
    status: decision.decision,
    decidedAt: context.now,
    decisionNote: decision.note?.trim() || null,
  });
}

export function workflowApprovalFacts(approval: WorkflowApprovalRequest, now: string) {
  return {
    workflowId: approval.workflowId,
    runId: approval.runId,
    stepId: approval.stepId,
    definitionVersion: approval.definitionVersion,
    targetKind: approval.target.kind,
    risk: approval.risk,
    minutesRemaining: Math.max(0, Math.ceil((Date.parse(approval.expiresAt) - Date.parse(now)) / 60_000)),
    canDecide: approval.status === "pending" && Date.parse(now) < Date.parse(approval.expiresAt),
  } as const;
}
