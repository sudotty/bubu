import { readFileSync } from "node:fs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const requireText = (path, values, label) => {
  const source = read(path);
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`);
};

requireText("packages/contracts/src/local-rag.ts", ["knowledgeSourceImportInputSchema", "knowledgeSearchResultSchema", "knowledgeDisclosurePreviewSchema", "knowledgeDisclosurePreparationSchema", "parseKnowledgeAnswerText", "disclosed chunk"], "versioned local knowledge contract");
requireText("packages/product-core/src/local-rag.ts", ["assertCurrentKnowledgeCitations", "knowledgeDisclosureFacts", "Knowledge citation is stale"], "pure local knowledge policy");
requireText("services/data-core/internal/data/migration_local_rag.go", ["knowledge_source_versions", "knowledge_chunks_fts", "unicode61", "knowledge_chunks_after_delete"], "SQLite local knowledge authority");
requireText("services/data-core/internal/data/local_rag_store.go", ["ImportKnowledgeSource", "maximumKnowledgeSources", "insertKnowledgeVersion", "DELETE FROM knowledge_sources"], "transactional local knowledge lifecycle");
requireText("services/data-core/internal/data/local_rag_search.go", ["knowledgeFTSTerms", "unicode.Han", "bm25(knowledge_chunks_fts)", "currentKnowledgeVersions"], "bounded lexical retrieval");
requireText("services/data-core/internal/data/local_rag_disclosure.go", ["PreviewKnowledgeDisclosure", "exact current source versions", "authoritative local content", "64 KiB"], "authoritative disclosure preview");
requireText("services/data-core/internal/data/local_rag_test.go", ["ImportsSearchablePDFTextLayer", "SupportsChineseQuestionsWithoutRawFTSSyntax", "stale citations were accepted", "deleted source remained searchable"], "local knowledge behavior proof");
requireText("services/data-core/internal/data/backup_local_rag_validation.go", ["validateBackupKnowledgeSources", "exact current version", "chunk counts"], "backup local knowledge integrity");
requireText("apps/desktop/src/main/knowledge-api.ts", ["assertKnowledgeChunksAllowed", "approvals.consume", "payloadSha256", 'purpose: "knowledge-answer"', 'disclosure: "retrieved-chunks"'], "one-use audited desktop path");
requireText("apps/desktop/src/renderer/KnowledgeWorkspace.tsx", ["业务知识", "仅在本地检索", "一次性知识披露审查", "批准一次并生成回答", "查看引用"], "local knowledge product flow");
requireText("apps/desktop/src/main.ts", ["smoke-refund-policy.md", "verifyPackagedKnowledgeRenderer"], "packaged local knowledge setup");
requireText("apps/desktop/src/main/packaged-smoke.ts", ["BUBU_PACKAGED_LOCAL_RAG_OK"], "packaged local knowledge evidence");
requireText("scripts/smoke-packaged-desktop.mjs", ["BUBU_PACKAGED_LOCAL_RAG_OK"], "packaged marker gate");
requireText("docs/product/local-knowledge.md", ["renderer never receives a local path", "Strict-private mode", "SQLite FTS", "one-use approval", "BUBU_PACKAGED_LOCAL_RAG_OK"], "current local knowledge guide");
const manifest = loadProductManifest(new URL("..", import.meta.url));
requireManifestFacts(manifest, ["local-rag: implemented", "packaged-local-rag-journey: implemented"], failures, "manifest local knowledge truth");
if (!manifest.privacy.allowedDisclosureLevels?.includes("retrieved-chunks")) failures.push("manifest local knowledge truth is missing retrieved-chunks disclosure");

if (failures.length > 0) {
  console.error(`Local RAG verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Local RAG verified: versioned sources, bounded retrieval, exact citations, one-use disclosure, audit, UI, backup, and packaged evidence.");
