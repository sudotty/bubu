# Approved MCP Resource Read Implementation Plan

> **Execution:** Test-drive every boundary on `main`, keep MCP output local and untrusted, and never include the user-owned legacy Wails workspace in a commit.

**Status:** Active.

**Goal:** Let a user choose one resource discovered during an approved local stdio MCP inspection, review the exact server launch and URI disclosure, approve one bounded read, and inspect normalized local-only content without giving the renderer or a model generic MCP authority.

**Architecture:** The sandboxed renderer can request only named prepare/approve/dismiss/list-audit operations. Electron main resolves the encrypted connection, creates a redacted exact-request proposal, retains only a launch fingerprint in the one-use session, records an append-only private audit, and routes cancellation through the existing operation registry. The Node AI utility reconnects with the official SDK, proves the resource is still present within the bounded discovery window, reads exactly one URI, normalizes text or binary metadata, closes in `finally`, and returns no SDK object or server `_meta`. The Go data core and all model providers remain outside this path.

**Fixed limits:** 20 pending approvals, 10-minute one-use lifetime, 30-second end-to-end deadline, five discovery pages, 100 discovered resources, one requested URI, 20 returned content parts, 256 KiB total decoded content, 2,000-character URIs, and 10,000 append-only local audit starts. Oversize or malformed content fails closed; it is never silently truncated.

**Binary policy:** Text content can be displayed as escaped text. Blob content is base64-validated and counted locally, but only its MIME type, decoded byte size, and SHA-256 digest cross into the renderer. BuBu does not render, execute, open, save, upload, or send binary content to a model in this slice.

**Deliberate exclusions:** No resource templates, arbitrary URI entry, subscription, background refresh, prompt retrieval, tool execution, model context injection, workflow/Agent registration, remote Streamable HTTP, OAuth, or OS-sandbox claim. Local MCP code still runs with desktop-user authority after explicit launch consent.

---

## Task 1: Define exact resource-read, result, and audit contracts

**Files:**

- Modify `packages/contracts/src/mcp.ts`
- Modify `packages/contracts/src/mcp.test.ts`

1. Write failing tests for one discovered URI, fixed read budgets, redacted proposal, one-use approval, strict text/blob result unions, decoded-byte accounting, local-only/untrusted labels, and audit start/outcome state.
2. Keep secret-bearing launch invocation separate from renderer-visible proposals and results.
3. Reject unbounded arrays, invalid base64/digests, server `_meta`, arbitrary methods, content HTML execution, and any result over the decoded or serialized byte limits.

## Task 2: Add append-only private MCP operation audit persistence

**Files:**

- Create `apps/desktop/src/main/mcp-audit-store.ts`
- Create `apps/desktop/src/main/mcp-audit-store.test.ts`
- Modify `apps/desktop/src/main.ts`

1. Persist one immutable `0600` start record and at most one immutable `0600` outcome record per audit under a `0700` directory using atomic creation.
2. Record connection ID/name, operation kind, exact URI, request fingerprint, timestamps, terminal status, returned part/byte counts, and normalized error code; never record environment values or resource content.
3. Fail closed at 10,000 starts, reject corruption/duplicates, and represent a persisted start without an outcome as interrupted after restart.

## Task 3: Add redacted one-use resource-read approval

**Files:**

- Create `apps/desktop/src/main/mcp-resource-approval-sessions.ts`
- Create `apps/desktop/src/main/mcp-resource-approval-sessions.test.ts`

1. Bind a 256-bit, ten-minute, one-use capability to connection ID/name, canonical executable, ordered arguments, decrypted-environment fingerprint, private working directory, exact resource URI, and fixed budget.
2. Store no decrypted environment value in the pending session; retain only connection ID, URI, and SHA-256 exact-request fingerprint.
3. Preparing or dismissing performs no utility-process I/O. Exact expiry is invalid, and post-review connection/request drift forces a new proposal.

## Task 4: Implement bounded official-SDK resource reading

**Files:**

- Refactor `services/ai-runtime/src/mcp/client.ts`
- Modify `services/ai-runtime/src/mcp/client.test.ts`
- Modify `scripts/fixtures/mcp-inspection-server.mjs`

1. Reuse one official `Client`/`StdioClientTransport` lifecycle helper for inspection and resource read, keeping explicit environment/cwd, cancellation, deadline, and `finally` close.
2. Re-list only advertised resources within the existing five-page/100-item discovery bound and require an exact URI match before one `client.readResource` call.
3. Validate at most 20 content parts and 256 KiB decoded total. Return escaped text or blob metadata/digest only; discard `_meta`, stderr, raw frames, and blob bytes.
4. Extend the fixture with invocation sentinels and prove exactly one approved resource is read while tools/prompts/subscriptions remain unused.

## Task 5: Extend named RPC, desktop orchestration, and cancellation

**Files:**

- Modify `services/ai-runtime/src/handler.ts`
- Modify `services/ai-runtime/src/handler.test.ts`
- Modify `services/ai-runtime/src/dispatcher.ts`
- Modify `services/ai-runtime/src/dispatcher.test.ts`
- Modify `apps/desktop/src/main/sidecars.ts`
- Create `apps/desktop/src/main/mcp-resource-api.ts`
- Create `apps/desktop/src/main/mcp-resource-api.test.ts`
- Modify `apps/desktop/src/main/desktop-api.ts`
- Modify `apps/desktop/src/shared/product-api.ts`
- Modify `apps/desktop/src/preload.ts`

1. Add only named list-audits/prepare-resource-read/approve-resource-read/dismiss-resource-read operations; keep generic JSON-RPC, URI entry, SDK methods, and resource content writes unavailable.
2. Consume approval and append the audit start before process I/O. Re-resolve and fingerprint the exact request, invoke under the named cancellation registry, then append one success/failure outcome without storing content.
3. Return only the strict local-only result and strict local audit view.

## Task 6: Add exact review, safe local display, and audit history

**Files:**

- Modify `apps/desktop/src/renderer/McpSettings.tsx`
- Modify `apps/desktop/src/renderer/styles.css`
- Modify packaged desktop smoke expectations in `apps/desktop/src/main.ts`

1. Resource rows from the current inspection get a named “审查读取” action; users cannot type an arbitrary URI.
2. The second-step review shows canonical executable, every argument, exact URI, expiry, byte/item/time limits, and explicit statements that the URI is sent to local code and returned content is untrusted/local-only.
3. Render text only through React text nodes and blob metadata only as text. Add cancel/dismiss/retry behavior and a bounded recent audit list with no resource content.

## Task 7: Close product contracts and end-to-end evidence

**Files:**

- Modify `scripts/smoke-mcp.mjs`
- Modify `scripts/verify-architecture.mjs`
- Modify `scripts/verify-repository.mjs`
- Modify `PRODUCT_MANIFEST.yaml`
- Modify `README.md`
- Modify `docs/architecture/mcp-host-security.md`
- Modify `docs/plans/2026-07-17-electron-migration-implementation.md`
- Modify this plan

1. Extend the real MCP smoke to prove exact approved read behavior, local-only normalization, binary redaction, cancellation/cleanup, environment isolation, and zero tool/prompt/subscription use.
2. Add fitness functions for append-only no-content audit, no pending plaintext secret, exact URI approval/drift, fixed budgets, one `readResource` site, forbidden MCP methods, named preload/RPC, escaped UI, and manifest/docs agreement.
3. Mark only `mcp-resource-read` implemented. Keep prompt use, tool execution, model/Agent/workflow registration, remote HTTP/OAuth, subscriptions, and templates planned.
4. Run `volta run npm run verify`, record exact evidence, stage only this slice, run `git diff --cached --check`, commit directly to `main`, push, and confirm local/remote alignment without touching legacy user work.
