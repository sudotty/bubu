export type RecurringWorkState = "waiting-file" | "running" | "needs-attention" | "completed" | "scheduled";
export type RecurringWorkKind = "derived-recompute" | "reconciliation-replay" | "workflow";

export interface RecurringWorkItem {
  readonly id: string;
  readonly kind: RecurringWorkKind;
  readonly state: RecurringWorkState;
  readonly title: string;
  readonly targetKind: "dataset" | "group";
  readonly targetId: string;
  readonly reasonKind: string | null;
  readonly attempt: number | null;
  readonly occurredAt: string;
  readonly nextAt: string | null;
  readonly recoverable: boolean;
}

export interface RecurringWorkInput {
  readonly recomputes: readonly { readonly id: string; readonly targetDatasetId: string; readonly targetDisplayName: string; readonly status: string; readonly reasonKind: string | null; readonly attempt: number; readonly createdAt: string; readonly finishedAt: string | null }[];
  readonly reconciliations: readonly { readonly id: string; readonly definitionId: string; readonly triggerDatasetId: string; readonly status: string; readonly reasonKind: string | null; readonly attempt: number; readonly createdAt: string; readonly finishedAt: string | null }[];
  readonly workflows: readonly { readonly id: string; readonly name: string; readonly target: { readonly kind: "dataset" | "group"; readonly id: string }; readonly triggerKind: string; readonly nextDueAt: string | null; readonly updatedAt: string; readonly latestRun: { readonly status: string; readonly startedAt: string; readonly finishedAt: string | null } | null }[];
  readonly groupForDataset: ReadonlyMap<string, { readonly id: string; readonly name: string }>;
}

const activeRank: Record<RecurringWorkState, number> = { "needs-attention": 0, running: 1, "waiting-file": 2, scheduled: 3, completed: 4 };

function eventState(status: string): RecurringWorkState | null {
  if (status === "pending" || status === "running") return "running";
  if (status === "paused" || status === "failed") return "needs-attention";
  if (status === "succeeded") return "completed";
  return null;
}

function latestBy<T>(values: readonly T[], key: (value: T) => string, at: (value: T) => string): readonly T[] {
  const latest = new Map<string, T>();
  for (const value of values) {
    const current = latest.get(key(value));
    if (!current || at(value) > at(current)) latest.set(key(value), value);
  }
  return [...latest.values()];
}

export function deriveRecurringWorkItems(input: RecurringWorkInput): readonly RecurringWorkItem[] {
  const items: RecurringWorkItem[] = [];
  for (const event of latestBy(input.recomputes, ({ targetDatasetId }) => targetDatasetId, ({ createdAt }) => createdAt)) {
    const state = eventState(event.status); if (!state) continue;
    items.push({ id: event.id, kind: "derived-recompute", state, title: event.targetDisplayName, targetKind: "dataset", targetId: event.targetDatasetId, reasonKind: event.reasonKind, attempt: event.attempt, occurredAt: event.finishedAt ?? event.createdAt, nextAt: null, recoverable: state === "needs-attention" && event.attempt < 3 });
  }
  for (const event of latestBy(input.reconciliations, ({ definitionId }) => definitionId, ({ createdAt }) => createdAt)) {
    const state = eventState(event.status); if (!state) continue;
    const owner = input.groupForDataset.get(event.triggerDatasetId); if (!owner) continue;
    items.push({ id: event.id, kind: "reconciliation-replay", state, title: `${owner.name} · 对账`, targetKind: "group", targetId: owner.id, reasonKind: event.reasonKind, attempt: event.attempt, occurredAt: event.finishedAt ?? event.createdAt, nextAt: null, recoverable: state === "needs-attention" && event.attempt < 3 });
  }
  for (const workflow of input.workflows) {
    const run = workflow.latestRun;
    const state: RecurringWorkState = run?.status === "running" ? "running" : run?.status === "failed" ? "needs-attention" : workflow.triggerKind === "dataset-version" ? "waiting-file" : workflow.nextDueAt ? "scheduled" : "completed";
    items.push({ id: workflow.id, kind: "workflow", state, title: workflow.name, targetKind: workflow.target.kind, targetId: workflow.target.id, reasonKind: run?.status === "failed" ? "workflow-failed" : null, attempt: null, occurredAt: run?.finishedAt ?? run?.startedAt ?? workflow.updatedAt, nextAt: workflow.nextDueAt, recoverable: run?.status === "failed" });
  }
  return items.toSorted((left, right) => activeRank[left.state] - activeRank[right.state] || right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id));
}
