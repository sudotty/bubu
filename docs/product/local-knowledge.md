# Local business knowledge and cited answers

Status: implemented for versioned TXT, Markdown, and text-layer PDF sources.

BuBu exposes **业务知识** as a first-class local workspace. Import happens through the operating-system picker in Electron main, so the renderer never receives a local path. The Go data core reads at most 20 MiB, extracts at most 8 MiB of UTF-8 text, creates at most 2,000 deterministic line-bounded chunks, and stores the text and index in the local SQLite database. Scanned PDFs without a readable text layer are rejected rather than silently producing an empty index.

Each source has one current immutable version. Rebuild creates a new version and atomically activates it; old citations then fail current-version validation. Delete removes the source, every version, all chunks, and the FTS entries. Backup and restore validate source/version ownership, current-version pointers, chunk bounds and counts. Local paths are never persisted.

## Retrieval and citations

The first release uses SQLite FTS lexical retrieval, including bounded Chinese two-character prefixes. User text is tokenized and escaped before it reaches `MATCH`; raw FTS syntax is never executed. Results are limited to 12 chunks and include exact source, source version, chunk, ordinal, line range, text, and a bounded relevance score.

Local search is always available without a model. A cited model answer is a separate operation:

1. the user selects exactly one source, enters a query and states the answer purpose;
2. Go performs the search and produces the canonical disclosure preview and SHA-256;
3. the UI shows every exact chunk, byte count, model, and endpoint origin;
4. a ten-minute, one-use approval binds search, source version, chunks, purpose, destination, byte count and digest;
5. after approval BuBu repeats retrieval and preview generation; any source, result, or destination drift fails closed;
6. local DLP runs again, the model disclosure ledger records only counts and a payload digest, and the strict parser accepts citations only to disclosed chunk IDs.

Strict-private mode keeps local retrieval available but rejects chunk disclosure to any model. Local-private mode still applies DLP and explicit one-use approval. The model has no SQL, file, network, MCP, memory, or tool authority in this flow.

## Deliberate limits

- One model-answer approval covers one selected source; users can search other sources separately.
- OCR, embeddings, vector databases, rerankers, automatic ingestion folders, knowledge use inside workflows, and organization-wide knowledge are not implemented.
- Source rebuild uses the already stored extracted text. To ingest changed file contents, delete and import the changed document as a new source.
- Local knowledge is product context, not a route for spreadsheet raw rows. Explicit spreadsheet row disclosure remains a separate, smaller contract and approval.

The packaged desktop smoke must emit `BUBU_PACKAGED_LOCAL_RAG_OK`, proving source restore, Chinese local retrieval, exact disclosure review, model approval, strict answer parsing, and citation navigation in the packaged renderer.
