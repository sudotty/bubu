import type { WorkflowTrigger } from "../shared/product-api.js";

export type TriggerPreset = "manual" | "daily" | "weekly" | "monthly" | "dataset-version";

export interface WorkflowScheduleDraft {
  readonly preset: TriggerPreset;
  readonly hour: number;
  readonly minute: number;
  readonly weekday: number;
  readonly dayOfMonth: number;
}

const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function boundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function clockLabel(schedule: WorkflowScheduleDraft): string {
  return `${String(boundedInteger(schedule.hour, 0, 23)).padStart(2, "0")}:${String(boundedInteger(schedule.minute, 0, 59)).padStart(2, "0")}`;
}

export function scheduleDescription(schedule: WorkflowScheduleDraft, timeZone: string): string {
  if (schedule.preset === "manual") return "仅在你点击运行时执行，不会自动触发。";
  if (schedule.preset === "dataset-version") return "目标数据出现新版本后自动执行，并把结果送回当前任务。";
  const time = clockLabel(schedule);
  if (schedule.preset === "daily") return `每天 ${time} 自动执行（${timeZone}）。`;
  if (schedule.preset === "weekly") return `每${weekdayLabels[boundedInteger(schedule.weekday, 0, 6)]} ${time} 自动执行（${timeZone}）。`;
  return `每月 ${boundedInteger(schedule.dayOfMonth, 1, 28)} 日 ${time} 自动执行（${timeZone}）。`;
}

export function triggerFromSchedule(schedule: WorkflowScheduleDraft, timeZone: string): WorkflowTrigger {
  if (schedule.preset === "manual") return { kind: "manual" };
  if (schedule.preset === "dataset-version") return { kind: "dataset-version" };
  const hour = boundedInteger(schedule.hour, 0, 23);
  const minute = boundedInteger(schedule.minute, 0, 59);
  if (schedule.preset === "daily") return { kind: "calendar", cadence: "daily", timeZone, hour, minute };
  if (schedule.preset === "weekly") return { kind: "calendar", cadence: "weekly", timeZone, hour, minute, weekday: boundedInteger(schedule.weekday, 0, 6) };
  return { kind: "calendar", cadence: "monthly", timeZone, hour, minute, dayOfMonth: boundedInteger(schedule.dayOfMonth, 1, 28) };
}
