import { Check, Circle, LoaderCircle, ShieldCheck } from "lucide-react";

type TaskState = "idle" | "planning" | "proposed" | "executing" | "complete" | "failed";

const steps = ["理解问题", "审查计划", "本地执行"] as const;

function stateIndex(state: TaskState): number {
  if (state === "planning") return 0;
  if (state === "proposed") return 1;
  return state === "executing" || state === "complete" ? 2 : -1;
}

export function TaskRunStatus({ state }: { readonly state: TaskState }) {
  const active = stateIndex(state);
  const label = state === "idle" ? "等待一个新问题" : state === "planning" ? "正在生成受限计划" : state === "proposed" ? "等待你批准本地执行" : state === "executing" ? "正在由 Go 数据内核执行" : state === "complete" ? "本地任务已完成" : "任务需要重试";
  return <section className={`task-run-status task-${state}`} aria-live="polite">
    <header><span><ShieldCheck size={15} />本地任务状态</span><small>{label}</small></header>
    <ol>{steps.map((step, index) => <li key={step} className={index < active || state === "complete" ? "task-step-done" : index === active ? "task-step-active" : ""}>{index < active || state === "complete" ? <Check size={13} /> : index === active && (state === "planning" || state === "executing") ? <LoaderCircle size={13} /> : <Circle size={13} />}<span>{step}</span></li>)}</ol>
  </section>;
}
