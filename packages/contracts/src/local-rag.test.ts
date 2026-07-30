import { describe, expect, it } from "vitest";
import { parseKnowledgeAnswerText, parseKnowledgeDisclosurePreview, parseKnowledgeSearchResult, parseKnowledgeSource } from "./local-rag.js";

const source = { schemaVersion: 1, id: "a".repeat(32), versionId: "b".repeat(32), displayName: "退款规则.md", kind: "markdown", sourceBytes: 1200, sourceSha256: "c".repeat(64), chunkCount: 2, status: "ready", importedAt: "2026-07-29T00:00:00Z" };
const citation = { sourceId: source.id, versionId: source.versionId, chunkId: "d".repeat(32), ordinal: 0, startLine: 1, endLine: 4, text: "退款必须在 30 天内提交。", score: 0.8 };

describe("local RAG contracts", () => {
  it("keeps versioned local sources and exact retrieval citations bounded", () => {
    expect(parseKnowledgeSource(source)).toEqual(source);
    const result = parseKnowledgeSearchResult({ schemaVersion: 1, query: "退款期限", sourceVersions: [{ sourceId: source.id, versionId: source.versionId }], citations: [citation], searchedAt: "2026-07-29T00:01:00Z" });
    expect(result.citations[0]?.chunkId).toBe(citation.chunkId);
    expect(() => parseKnowledgeSearchResult({ ...result, citations: [{ ...citation, localPath: "/secret" }] })).toThrow();
  });

  it("binds model disclosure to exact chunks and rejects invented citations", () => {
    const preview = parseKnowledgeDisclosurePreview({ schemaVersion: 1, purpose: "回答退款政策", query: "退款期限", citations: [citation], payloadBytes: 800, payloadSha256: "e".repeat(64) });
    expect(parseKnowledgeAnswerText(JSON.stringify({ schemaVersion: 1, answer: "退款需在 30 天内提交。", citations: [{ chunkId: citation.chunkId }] }), preview).citations).toEqual([{ chunkId: citation.chunkId }]);
    expect(() => parseKnowledgeAnswerText(JSON.stringify({ schemaVersion: 1, answer: "未知", citations: [{ chunkId: "f".repeat(32) }] }), preview)).toThrow("disclosed chunk");
  });
});
