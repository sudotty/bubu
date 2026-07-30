export type RemoteWorkflowApplicationBlockCode = "UNSUPPORTED_OBJECT_KIND" | "REMOTE_TOMBSTONE" | "CONTENT_DIGEST_CHANGED" | "LOCAL_TARGET_MISSING" | "LOCAL_THREAD_MISMATCH";
export interface RemoteWorkflowApplicationFacts { readonly objectKind: string; readonly deleted: boolean; readonly expectedContentSha256: string; readonly actualContentSha256: string; readonly localTargetExists: boolean; readonly localThreadMatches: boolean; readonly alreadyApplied: boolean }
export type RemoteWorkflowApplicationDecision = { readonly status: "ready" } | { readonly status: "already-applied" } | { readonly status: "blocked"; readonly code: RemoteWorkflowApplicationBlockCode };

export function decideRemoteWorkflowApplication(facts: RemoteWorkflowApplicationFacts): RemoteWorkflowApplicationDecision {
  if (facts.objectKind !== "workflow-definition") return { status: "blocked", code: "UNSUPPORTED_OBJECT_KIND" };
  if (facts.deleted) return { status: "blocked", code: "REMOTE_TOMBSTONE" };
  if (facts.expectedContentSha256 !== facts.actualContentSha256) return { status: "blocked", code: "CONTENT_DIGEST_CHANGED" };
  if (!facts.localTargetExists) return { status: "blocked", code: "LOCAL_TARGET_MISSING" };
  if (!facts.localThreadMatches) return { status: "blocked", code: "LOCAL_THREAD_MISMATCH" };
  if (facts.alreadyApplied) return { status: "already-applied" };
  return { status: "ready" };
}
