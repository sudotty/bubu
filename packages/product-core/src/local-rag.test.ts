import { describe, expect, it } from "vitest";
import type { KnowledgeDisclosurePreview, KnowledgeSearchResult, KnowledgeSource } from "@bubu/contracts";
import { assertCurrentKnowledgeCitations, knowledgeDisclosureFacts } from "./local-rag.js";

const source = { schemaVersion: 1, id: "a".repeat(32), versionId: "b".repeat(32), displayName: "规则.md", kind: "markdown", sourceBytes: 100, sourceSha256: "c".repeat(64), chunkCount: 1, status: "ready", importedAt: "2026-07-29T00:00:00Z" } satisfies KnowledgeSource;
const citation = { sourceId: source.id, versionId: source.versionId, chunkId: "d".repeat(32), ordinal: 0, startLine: 1, endLine: 3, text: "规则", score: 1 };

describe("local RAG product policy", () => {
  it("rejects stale citations and derives content-free disclosure facts", () => {
    const result = { schemaVersion: 1, query: "规则", sourceVersions: [{ sourceId: source.id, versionId: source.versionId }], citations: [citation], searchedAt: source.importedAt } satisfies KnowledgeSearchResult;
    expect(assertCurrentKnowledgeCitations(result, [source])).toBe(result);
    expect(() => assertCurrentKnowledgeCitations(result, [{ ...source, versionId: "e".repeat(32) }])).toThrow("stale");
    const preview = { schemaVersion: 1, purpose: "回答", query: "规则", citations: [citation], payloadBytes: 80, payloadSha256: "f".repeat(64) } satisfies KnowledgeDisclosurePreview;
    expect(knowledgeDisclosureFacts(preview)).toEqual({ sourceCount: 1, chunkCount: 1, lineCount: 3, payloadBytes: 80, fingerprintPrefix: "ffffffffffff" });
  });
});
