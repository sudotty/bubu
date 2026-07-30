import { describe, expect, it } from "vitest";
import { buildKnowledgeAnswerInvocation, createKnowledgeAnswer } from "./knowledge-orchestrator.js";

const disclosure = { schemaVersion: 1 as const, purpose: "answer", query: "refund", citations: [{ sourceId: "a".repeat(32), versionId: "b".repeat(32), chunkId: "c".repeat(32), ordinal: 0, startLine: 1, endLine: 2, text: "Refund in 30 days.", score: 1 }], payloadBytes: 200, payloadSha256: "d".repeat(64) };
const resolved = { profile: { id: "e".repeat(32), name: "Provider", kind: "openai" as const, baseUrl: "https://api.example.com", model: "model" }, credential: "secret" };

describe("knowledge answer orchestration", () => {
  it("sends only exact disclosure and has no tool authority", () => {
    const invocation = buildKnowledgeAnswerInvocation(resolved, disclosure);
    expect(JSON.parse(invocation.user)).toEqual({ purpose: disclosure.purpose, query: disclosure.query, citations: disclosure.citations });
    expect(invocation.system).toContain("no tools");
  });

  it("rejects an answer citing an undisclosed chunk", () => {
    expect(() => createKnowledgeAnswer(disclosure, { providerId: resolved.profile.id, providerKind: resolved.profile.kind, model: resolved.profile.model, text: JSON.stringify({ schemaVersion: 1, answer: "unsupported", citations: [{ chunkId: "f".repeat(32) }] }), usage: {} })).toThrow("disclosed chunk");
  });
});
