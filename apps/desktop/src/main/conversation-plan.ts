import type {
  ConversationThread,
  SafeGroupQueryPlan,
  SafeGroupQueryResult,
  SafeQueryPlan,
  SafeQueryResult,
} from "@bubu/contracts";

export function containsProposedPlan(thread: ConversationThread | null, plan: unknown): boolean {
  const encoded = JSON.stringify(plan);
  return thread?.entries.some((entry) =>
    entry.kind === "plan" && JSON.stringify(entry.payload.proposal.plan) === encoded,
  ) ?? false;
}

export function findReviewedAggregateSource(
  thread: ConversationThread | null,
  plan: SafeQueryPlan | SafeGroupQueryPlan,
): { readonly question: string; readonly result: SafeQueryResult | SafeGroupQueryResult } | null {
  if (!thread) return null;
  const encoded = JSON.stringify(plan);
  const resultIndex = thread.entries.findLastIndex((entry) =>
    entry.kind === "result" && JSON.stringify(entry.payload.sourcePlan) === encoded,
  );
  if (resultIndex < 0) return null;
  for (let index = resultIndex - 1; index >= 0; index--) {
    const entry = thread.entries[index];
    if (entry?.kind === "plan" && JSON.stringify(entry.payload.proposal.plan) === encoded) {
      const resultEntry = thread.entries[resultIndex];
      if (resultEntry?.kind !== "result") return null;
      return { question: entry.payload.proposal.question, result: resultEntry.payload.result };
    }
  }
  return null;
}
