import type { ConversationEntry } from "../shared/product-api.js";

export type TaskLifecycleState =
  | "draft"
  | "planning"
  | "awaiting-approval"
  | "executing"
  | "completed"
  | "needs-attention"
  | "cancelled";

export function isCancellation(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === "AbortError") return true;
  if (reason instanceof Error && reason.name === "AbortError") return true;
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return /cancelled|canceled|已取消|取消/u.test(message);
}

export function derivePersistedTaskState(entries: readonly ConversationEntry[]): TaskLifecycleState {
  const latest = entries.at(-1);
  if (!latest) return "draft";
  if (latest.kind === "result" || latest.kind === "insight") return "completed";
  if (latest.kind === "plan") return "awaiting-approval";
  if (latest.kind === "error") return isCancellation(latest.payload.message) ? "cancelled" : "needs-attention";
  // A persisted question without its following plan means the app or provider stopped mid-step.
  return "needs-attention";
}
