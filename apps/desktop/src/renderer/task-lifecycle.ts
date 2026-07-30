import type { ConversationEntry } from "../shared/product-api.js";

export type TaskLifecycleState =
  | "draft"
  | "planning"
  | "awaiting-approval"
  | "executing"
  | "completed"
  | "needs-attention"
  | "cancelled";

type QuestionEntry = Extract<ConversationEntry, { readonly kind: "question" }>;
type PlanEntry = Extract<ConversationEntry, { readonly kind: "plan" }>;
type ResultEntry = Extract<ConversationEntry, { readonly kind: "result" }>;
type ErrorEntry = Extract<ConversationEntry, { readonly kind: "error" }>;

export interface LatestTaskSnapshot {
  readonly entries: readonly ConversationEntry[];
  readonly question?: QuestionEntry | undefined;
  readonly plan?: PlanEntry | undefined;
  readonly result?: ResultEntry | undefined;
  readonly error?: ErrorEntry | undefined;
}

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

export function latestTaskSnapshot(entries: readonly ConversationEntry[]): LatestTaskSnapshot {
  const questionIndex = entries.findLastIndex((entry) => entry.kind === "question");
  const scopedEntries = questionIndex === -1 ? entries : entries.slice(questionIndex);
  return {
    entries: scopedEntries,
    question: scopedEntries.findLast((entry): entry is QuestionEntry => entry.kind === "question"),
    plan: scopedEntries.findLast((entry): entry is PlanEntry => entry.kind === "plan"),
    result: scopedEntries.findLast((entry): entry is ResultEntry => entry.kind === "result"),
    error: scopedEntries.findLast((entry): entry is ErrorEntry => entry.kind === "error"),
  };
}
