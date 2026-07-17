import type { ConversationThread } from "@bubu/contracts";

export function containsProposedPlan(thread: ConversationThread | null, plan: unknown): boolean {
  const encoded = JSON.stringify(plan);
  return thread?.entries.some((entry) =>
    entry.kind === "plan" && JSON.stringify(entry.payload.proposal.plan) === encoded,
  ) ?? false;
}
