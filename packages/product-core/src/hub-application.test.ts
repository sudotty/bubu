import { describe, expect, it } from "vitest";
import { decideRemoteWorkflowApplication } from "./hub-application.js";

describe("remote workflow application policy", () => {
  it("fails closed unless a live workflow, exact digest, local target and explicit review agree", () => {
    const base = { objectKind: "workflow-definition" as const, deleted: false, expectedContentSha256: "a".repeat(64), actualContentSha256: "a".repeat(64), localTargetExists: true, localThreadMatches: true, alreadyApplied: false };
    expect(decideRemoteWorkflowApplication(base)).toEqual({ status: "ready" });
    expect(decideRemoteWorkflowApplication({ ...base, actualContentSha256: "b".repeat(64) })).toEqual({ status: "blocked", code: "CONTENT_DIGEST_CHANGED" });
    expect(decideRemoteWorkflowApplication({ ...base, deleted: true })).toEqual({ status: "blocked", code: "REMOTE_TOMBSTONE" });
    expect(decideRemoteWorkflowApplication({ ...base, localThreadMatches: false })).toEqual({ status: "blocked", code: "LOCAL_THREAD_MISMATCH" });
    expect(decideRemoteWorkflowApplication({ ...base, alreadyApplied: true })).toEqual({ status: "already-applied" });
  });
});
