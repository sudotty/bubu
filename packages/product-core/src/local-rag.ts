import type { KnowledgeDisclosurePreview, KnowledgeSearchResult, KnowledgeSource } from "@bubu/contracts";

export function assertCurrentKnowledgeCitations(result: KnowledgeSearchResult, sources: readonly KnowledgeSource[]): KnowledgeSearchResult {
  const current = new Map(sources.map((source) => [source.id, source.versionId]));
  for (const { sourceId, versionId } of result.sourceVersions) {
    if (current.get(sourceId) !== versionId) throw new Error("Knowledge search contains a stale source version");
  }
  for (const citation of result.citations) {
    if (current.get(citation.sourceId) !== citation.versionId) throw new Error("Knowledge citation is stale");
  }
  return result;
}

export function knowledgeDisclosureFacts(preview: KnowledgeDisclosurePreview) {
  return {
    sourceCount: new Set(preview.citations.map(({ sourceId }) => sourceId)).size,
    chunkCount: preview.citations.length,
    lineCount: preview.citations.reduce((total, citation) => total + citation.endLine - citation.startLine + 1, 0),
    payloadBytes: preview.payloadBytes,
    fingerprintPrefix: preview.payloadSha256.slice(0, 12),
  } as const;
}
