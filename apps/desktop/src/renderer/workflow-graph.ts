import type { WorkflowDefinition, WorkflowRun } from "../shared/product-api.js";

export type WorkflowGraphStatus = "idle" | "running" | "succeeded" | "failed";
export type WorkflowGraphNodeKind = "trigger" | "data" | "delivery" | "reminder";

export interface WorkflowGraphNode {
  readonly id: string;
  readonly kind: WorkflowGraphNodeKind;
  readonly label: string;
  readonly detail: string;
  readonly status: WorkflowGraphStatus;
}

export function workflowTriggerLabel(workflow: WorkflowDefinition): string {
  if (workflow.trigger.kind === "dataset-version") return "数据更新后";
  if (workflow.trigger.kind === "calendar") {
    const time = `${String(workflow.trigger.hour).padStart(2, "0")}:${String(workflow.trigger.minute).padStart(2, "0")}`;
    if (workflow.trigger.cadence === "weekly") return `每周一 ${time}`;
    if (workflow.trigger.cadence === "monthly") return `每月 ${workflow.trigger.dayOfMonth} 日 ${time}`;
    return `每天 ${time}`;
  }
  if (workflow.trigger.kind === "interval") {
    if (workflow.trigger.everyMinutes === 24 * 60) return "每天";
    if (workflow.trigger.everyMinutes === 7 * 24 * 60) return "每周";
    return workflow.trigger.everyMinutes === 30 * 24 * 60 ? "每月" : `每 ${workflow.trigger.everyMinutes} 分钟`;
  }
  return "手动";
}

export function buildWorkflowGraph(
  workflow: WorkflowDefinition | undefined,
  run: WorkflowRun | undefined,
  mode: "static" | "dynamic",
): readonly WorkflowGraphNode[] {
  if (!workflow) return [];
  const triggerDetail = workflowTriggerLabel(workflow);
  const runMatches = mode === "dynamic" && run?.workflowId === workflow.id;
  const stepStatus = (stepId: string): WorkflowGraphStatus => {
    if (!runMatches) return "idle";
    const attempt = run.steps.findLast((step) => step.stepId === stepId);
    if (!attempt) return run.status === "running" ? "running" : "idle";
    return attempt.status === "cancelled" ? "failed" : attempt.status;
  };
  const terminalStatus: WorkflowGraphStatus = !runMatches ? "idle" : run.status === "cancelled" ? "failed" : run.status;
  return [
    { id: "trigger", kind: "trigger", label: "触发业务周期", detail: triggerDetail, status: runMatches ? "succeeded" : "idle" },
    ...workflow.steps.map((step) => ({ id: step.id, kind: "data" as const, label: "读取并处理最新数据", detail: step.kind === "group-query" ? "多数据对象关联查询" : "单数据对象受限查询", status: stepStatus(step.id) })),
    { id: "reply", kind: "delivery", label: "发送结果到当前对话", detail: "结果和图表保存在任务中，可按需导出", status: terminalStatus },
    { id: "next", kind: "reminder", label: "提醒下一次更新", detail: workflow.nextDueAt ? new Date(workflow.nextDueAt).toLocaleString("zh-CN") : triggerDetail === "手动" ? "需要时再次运行" : "等待调度", status: terminalStatus === "failed" ? "failed" : "idle" },
  ];
}
