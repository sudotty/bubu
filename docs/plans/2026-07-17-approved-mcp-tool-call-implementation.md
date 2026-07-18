# Approved MCP Tool Call Implementation Plan

> **Execution:** Test-drive every boundary on the delivery branch. A discovered MCP tool is untrusted local code with potentially irreversible side effects; annotations never reduce approval requirements.

**Status:** Complete and verified on 2026-07-18.

**Goal:** Let a user choose one tool discovered during an approved local stdio MCP inspection, enter a bounded JSON object that validates against the exact discovered input schema, review every process detail and exact value, approve one bounded `tools/call`, and inspect a normalized result locally without automatically exposing the tool or result to a model, conversation, Agent, or workflow.

**Protocol basis:** The [MCP 2025-11-25 tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) defines paginated discovery, JSON Schema 2020-12 as the default dialect, `tools/call`, structured/unstructured results, untrusted annotations, user confirmation, input visibility, result validation, timeout, and audit guidance. Experimental task-augmented calls are deliberately excluded from this slice.

**Architecture:** The renderer selects only a tool from the current bounded snapshot and sends its canonical input-schema text, task-support state, and user-entered JSON object through named prepare/approve/dismiss operations. Electron main hashes the schema, creates separate exact secret/value-bound and persistent value-free fingerprints, retains no plaintext input in the one-use capability, and requires the renderer to resubmit the exact typed request on approval. The Node utility re-lists the exact tool, rejects schema/task-support drift, validates input and structured output locally with pinned no-network JSON Schema validators, invokes `callTool` exactly once, normalizes content under fixed budgets, and closes the client in `finally`.

**Fixed limits:** 20 pending approvals, 10-minute one-use lifetime, 30-second deadline, five discovery pages, 100 tools, 16 KiB discovered input schema, 32 KiB canonical input JSON, 100 top-level keys, 1,000 JSON nodes, depth 16, 8 KiB per string, 20 result content blocks, 256 KiB combined decoded text/binary/structured JSON, and 384 KiB serialized result. Malformed, cyclic, non-finite, unsupported-dialect, remote-ref, schema-drift, task-required, or oversized data fails closed.

**Side-effect policy:** Every manual call requires a fresh second approval regardless of `readOnlyHint`, `destructiveHint`, `idempotentHint`, or `openWorldHint`. The UI states that cancellation closes the request but cannot undo effects already performed by the server. No remembered approval, auto-run, retry, task polling, parallel call, resource-link follow, or model-driven invocation exists in this slice.

**Result policy:** Text and embedded text render escaped and local-only. Image/audio/embedded binary becomes type/URI/MIME/bytes/SHA-256 metadata. Resource links remain bounded metadata and are not followed. Structured content becomes canonical escaped JSON only after output-schema validation when a schema exists. `_meta`, annotations, stderr, SDK objects, raw binary, and content above budget do not cross. `isError` is preserved as untrusted tool status, not converted into host success semantics.

---

## Task 1: Extend discovery and strict tool contracts

- Modify `packages/contracts/src/mcp.ts` and tests.
- Add `taskSupport` to normalized tool summaries, strict bounded JSON-object traversal, fixed request/proposal/approval/invocation/result schemas, schema SHA-256 binding, normalized result content, structured JSON, and exact byte accounting.
- Extend MCP audit starts/events with a `tool-call` variant containing only tool name, sorted top-level input keys, canonical input byte count, and a value-free public request fingerprint.

## Task 2: Add no-plaintext one-use tool approval and audit proof

- Create `apps/desktop/src/main/mcp-tool-approval-sessions.ts` and tests.
- Bind canonical launch, decrypted environment, exact tool/schema/task state, exact input values, and budgets in the in-memory launch fingerprint while storing no plaintext input or secret.
- Prove expiry, revocation, bounded eviction, same-size value drift rejection, schema/task drift rejection, and value-free persisted fingerprints/audits.

## Task 3: Implement schema-bound official-SDK execution

- Pin direct `ajv` and `ajv-formats` runtime dependencies matching the reviewed SDK dependency and add a pure validator boundary supporting explicit draft-07 or default/explicit 2020-12 with no remote loading.
- Modify the MCP client, fixture, and tests.
- Re-list within five pages/100 tools, require exact name/schema/task state, reject task-required tools, validate exact arguments, call `client.callTool` once, validate structured output when `outputSchema` exists, normalize every supported result block, and close on success/error/timeout/cancel.

## Task 4: Add named RPC and audited Electron orchestration

- Extend AI handler/dispatcher, desktop sidecar, shared API, preload, and desktop registration using only `mcp.tool.call` and named IPC channels.
- Create `apps/desktop/src/main/mcp-tool-api.ts` and tests.
- Consume approval before I/O, re-resolve and fingerprint the resubmitted exact request, append the content-free audit start before launch, append exactly one normalized terminal outcome, and propagate cancellation without claiming rollback.

## Task 5: Build exact JSON review and local result UI

- Extend `McpSettings.tsx` and styles with a selected-tool JSON editor initialized to `{}`, visible discovered schema/annotations/task state, local parse errors, and a second exact review of executable, process arguments, environment keys, tool name, canonical input values, expiry, limits, and irreversible-effect warning.
- Disable task-required tools, render all returned blocks and structured JSON as escaped local-only content, expose `isError`, update append-only audit history, and never add an “insert into chat/model” action.

## Task 6: Close executable contracts and verification

- Extend real MCP smoke, architecture/repository gates, manifest, README, security contract, migration plan, and this plan.
- Require exactly one policy-bound `callTool`, `readResource`, and `getPrompt` site; no task/subscription/sampling/elicitation authority; exact schema-bound input validation; no input/result persistence; named APIs; safe UI; and docs/status agreement.
- Mark only `mcp-tool-call` implemented. Keep model/Agent/workflow tool registration, remembered permissions, task-augmented calls, remote MCP/OAuth, and automatic retries planned.
- Run `npm run verify`, record evidence, stage only this slice, and publish through a reviewed delivery branch without touching unrelated legacy Wails work.

## Implementation evidence

Tasks 1–6 are implemented across strict contracts, bounded schema validation, the official SDK client, named authenticated RPC/IPC, one-use approval sessions, content-free append-only audit, the exact JSON review UI, local-only result rendering, smoke coverage, manifest, and executable repository/architecture gates.

Fresh root `npm run verify` evidence on 2026-07-18: 69 contract, 34 AI-runtime, and 84 desktop tests passed; all Go packages passed; dependency audit reported zero vulnerabilities; repository, documentation, GitHub, architecture, build, data-core/MCP/desktop smoke, and performance gates passed. The MCP smoke discovered without invocation and then performed exactly one separately approved resource read, prompt get, and tool call. The 100 MiB / 183,246-row benchmark completed import/profile in 4,056.94 ms, query p95 in 162.96 ms, and peak data-core RSS at 36.09 MiB.
