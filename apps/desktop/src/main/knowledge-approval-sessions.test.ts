import { describe, expect, it } from "vitest";
import { createKnowledgeApprovalSessionStore } from "./knowledge-approval-sessions.js";

const search = { query: "refund", sourceIds: ["a".repeat(32)], limit: 5 };
const preview = { schemaVersion: 1 as const, purpose: "answer", query: "refund", citations: [{ sourceId: "a".repeat(32), versionId: "b".repeat(32), chunkId: "c".repeat(32), ordinal: 0, startLine: 1, endLine: 2, text: "Refund in 30 days.", score: 1 }], payloadBytes: 200, payloadSha256: "d".repeat(64) };
const destination = { providerId: "e".repeat(32), providerKind: "openai" as const, providerName: "Provider", model: "model", endpointOrigin: "https://api.example.com" };

describe("knowledge approval sessions", () => {
  it("binds exact search, preview, and destination to one use", () => {
    const store = createKnowledgeApprovalSessionStore({ now: () => 1_000, newToken: () => "f".repeat(64) });
    const proposal = store.issue(search, preview, destination);
    expect(store.consume(proposal.approvalToken)).toEqual({ search, preview, destination });
    expect(() => store.consume(proposal.approvalToken)).toThrow("already been used");
  });

  it("rejects expired approval", () => {
    let now = 1_000;
    const store = createKnowledgeApprovalSessionStore({ now: () => now, newToken: () => "f".repeat(64) });
    const proposal = store.issue(search, preview, destination);
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired");
  });
});
