import { Check, Circle, LoaderCircle, ShieldCheck } from "lucide-react";
import type { TaskLifecycleState } from "./task-lifecycle.js";

const steps = ["理解问题", "审查计划", "本地执行"] as const;

function stateIndex(state: TaskLifecycleState): number {
  if (state === "planning") return 0;
  if (state === "awaiting-approval") return 1;
  return state === "executing" || state === "completed" ? 2 : -1;
}

function durationLabel(startedAt?: number, completedAt?: number): string | undefined {
  if (startedAt === undefined || completedAt === undefined) return undefined;
  const milliseconds = Math.max(0, completedAt - startedAt);
  return milliseconds < 1_000 ? `${milliseconds} 毫秒` : `${(milliseconds / 1_000).toFixed(1)} 秒`;
}

export function TaskRunStatus({ state, startedAt, completedAt }: { readonly state: TaskLifecycleState; readonly startedAt?: number | undefined; readonly completedAt?: number | undefined }) {
  const active = stateIndex(state);
  const label = state === "draft" ? "等待一个新问题" : state === "planning" ? "正在生成受限计划" : state === "awaiting-approval" ? "等待你批准本地执行" : state === "executing" ? "正在由 Go 数据内核执行" : state === "completed" ? "本地任务已完成" : state === "cancelled" ? "任务已取消，可安全重试" : "任务需要处理";
  const duration = durationLabel(startedAt, completedAt);
  return <section className={`task-run-status task-${state}`} aria-live="polite">
    <header><span><ShieldCheck size={15} />本地任务状态</span><small>{label}{duration ? ` · ${duration}` : ""}</small></header>
    <ol>{steps.map((step, index) => <li key={step} className={index < active || state === "completed" ? "task-step-done" : index === active ? "task-step-active" : ""}>{index < active || state === "completed" ? <Check size={13} /> : index === active && (state === "planning" || state === "executing") ? <LoaderCircle size={13} /> : <Circle size={13} />}<span>{step}</span></li>)}</ol>
    {state !== "draft" && <p>{state === "planning" || state === "awaiting-approval" ? "远程模型只参与生成类型化计划；数据行不会随请求自动发送。" : state === "cancelled" ? "取消只终止当前操作，不会删除此前保存的问题、计划或结果。" : "确定性查询由本地 Go 数据内核执行，结果作为当前任务的 Artifact 保存。"}</p>}
  </section>;
}
