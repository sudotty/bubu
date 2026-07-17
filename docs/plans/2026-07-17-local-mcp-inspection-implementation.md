# Local MCP Connection and Inspection Implementation Plan

> **Execution:** Test-drive every boundary on `main`, use the official production TypeScript SDK, and keep the user-owned legacy Wails workspace out of every commit.

**Status:** Active.

**Goal:** Let a user persist a local stdio MCP server configuration, review the exact process launch, explicitly approve one connection, and inspect its negotiated tools, resources, and prompts without giving either the renderer or a model authority to launch commands or invoke MCP capabilities.

**Architecture:** BuBu remains the MCP host. The sandboxed renderer edits strict metadata and displays a complete launch review. Electron main owns encrypted environment values, executable validation, one-use launch approvals, and cancellation. The isolated Node AI utility process owns the official MCP client and stdio transport. Each inspection creates one connection, completes lifecycle negotiation and bounded paginated discovery, returns a normalized snapshot, and closes the client/process in `finally`. No MCP server talks to the Go data core, another MCP server, the renderer, a model, or the conversation history.

**Protocol decision:** Use `@modelcontextprotocol/sdk` v1.x because the official v2 SDK is still pre-release as of 2026-07-17. Follow MCP 2025-11-25 lifecycle, stdio, tools, resources, prompts, cancellation, and security guidance. Official references: [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [server primitives](https://modelcontextprotocol.io/specification/2025-11-25/server), [cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation), and [security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).

**Fixed limits:** 20 saved profiles, 20 encrypted environment entries per profile, 50 arguments, 30-second inspection deadline, five pages and 100 entries per primitive, 256 KiB normalized inspection result, and one active inspection per approved operation. Server descriptions, schemas, annotations, instructions, URIs, and stderr are untrusted data.

**Deliberate exclusions:** No Shell command, package runner (`npx`, `uvx`, and equivalents), one-click installer, auto-start, inherited BuBu/process environment, remote Streamable HTTP, OAuth, tool/resource/prompt invocation, roots, subscriptions, sampling, elicitation, model tool registration, workflow step, or background connection. Those require separate policy and approval slices.

---

## Task 1: Define strict MCP connection and inspection contracts

**Files:**

- Create `packages/contracts/src/mcp.ts`
- Create `packages/contracts/src/mcp.test.ts`
- Modify `packages/contracts/src/index.ts`

1. Write failing tests for opaque IDs, absolute executable paths, direct-process arguments, environment key/value limits, write-only secrets, public registry state, one-use inspection proposals, negotiated server identity, and bounded tool/resource/prompt summaries.
2. Model saved public metadata separately from secret-bearing configuration input and resolved utility-process input.
3. Reject Shells, privilege escalators, package runners, NUL/newline arguments, reserved BuBu credential keys, arbitrary capability blobs, oversized JSON Schemas, and tool names outside the protocol guidance.
4. Keep server annotations and instructions visibly `untrusted`; do not infer side-effect safety from them.

## Task 2: Persist public metadata and encrypted environment values in Electron main

**Files:**

- Create `apps/desktop/src/main/mcp-connection-store.ts`
- Create `apps/desktop/src/main/mcp-connection-store.test.ts`
- Modify `apps/desktop/src/main.ts`

1. Write failing tests for `0700` directories, `0600` atomic files, encrypted secret bundles, allocation/update/remove, corruption rejection, and absence of secret values from public state.
2. Reuse the operating-system encryption adapter already used by model credentials; fail closed when encryption is unavailable and environment values are supplied.
3. Never inherit `BUBU_RPC_TOKEN`, provider credentials, Electron flags, or the parent process environment into an MCP server.
4. Resolve and validate the executable again immediately before approval and execution; store the user-entered path but approve the canonical executable path.

## Task 3: Add capability-bound, one-use process-launch consent

**Files:**

- Create `apps/desktop/src/main/mcp-inspection-approval-sessions.ts`
- Create `apps/desktop/src/main/mcp-inspection-approval-sessions.test.ts`

1. Write failing tests for a 256-bit token, ten-minute expiry, one-use consumption, 20-session eviction, and binding to the exact canonical executable, argument array, environment-key list, server ID, and fixed inspection budget.
2. The proposal must show every command argument without truncation and state that the process runs with the user's desktop privileges.
3. Preparing an approval never launches a process. Dismissal revokes the token and performs no utility-process I/O.
4. Consuming a token before I/O and re-resolving the profile prevents post-approval edits or secret/profile substitution.

## Task 4: Implement the official-SDK stdio inspection client in the AI utility process

**Files:**

- Modify `services/ai-runtime/package.json`
- Create `services/ai-runtime/src/mcp/client.ts`
- Create `services/ai-runtime/src/mcp/client.test.ts`
- Modify `services/ai-runtime/src/handler.ts`
- Modify `services/ai-runtime/src/dispatcher.test.ts`

1. Add the official stable v1 SDK and verify its exact installed version and license through the repository dependency gate.
2. Connect with `Client` and `StdioClientTransport` using an absolute executable, argument array, private working directory, and only explicitly decrypted environment values. Never set `shell: true`.
3. Negotiate lifecycle capabilities, then paginate only advertised tools, resources, and prompts. Normalize and re-parse every untrusted item under the fixed count/byte budgets.
4. Disable sampling, elicitation, roots, and model callbacks. Propagate cancellation and the 30-second deadline, then close the client/transport in `finally` on success, protocol error, timeout, or cancellation.

## Task 5: Extend authenticated sidecar RPC and typed desktop orchestration

**Files:**

- Modify `apps/desktop/src/main/sidecars.ts`
- Create `apps/desktop/src/main/mcp-api.ts`
- Create `apps/desktop/src/main/mcp-api.test.ts`
- Modify `apps/desktop/src/main/desktop-api.ts`
- Modify `apps/desktop/src/shared/product-api.ts`
- Modify `apps/desktop/src/preload.ts`

1. Add only named list/save/remove/prepare-inspection/approve-inspection/dismiss-inspection commands; never expose a generic MCP request, method, transport, command runner, or tool call.
2. Save/remove operate only on the main-process store. Approved inspection runs through the named operation registry so the existing cancellation command reaches the utility process and MCP request.
3. Compare the current canonical resolved connection with the consumed approval before RPC. Any drift forces a new review.
4. Return only the strict normalized snapshot; never return environment values, full stderr, process environment, filesystem paths other than the exact approved executable, raw JSON-RPC frames, or SDK objects.

## Task 6: Build the MCP Connection Center and exact launch review

**Files:**

- Create `apps/desktop/src/renderer/McpSettings.tsx`
- Modify `apps/desktop/src/renderer/ProviderSettings.tsx`
- Modify `apps/desktop/src/renderer/styles.css`
- Modify `apps/desktop/src/main.ts`

1. Add a clear MCP section to Settings with saved profiles, direct executable/arguments, write-only environment entries, and a warning that local MCP code runs with desktop-user privileges.
2. Save does not connect. “Prepare inspection” opens a separate review containing the canonical executable, every argument, environment key names, expiry, limits, and prohibited capabilities; a second click performs the launch.
3. Show negotiated protocol/server identity and bounded tools/resources/prompts as escaped text. Label annotations, descriptions, instructions, and schemas untrusted.
4. Support cancel, dismiss, retry, update, and remove. Do not add a model toggle or an “enable all tools” control.

## Task 7: Add a real fixture, product contracts, and end-to-end verification

**Files:**

- Create `scripts/fixtures/mcp-inspection-server.mjs`
- Create `scripts/smoke-mcp.mjs`
- Modify `package.json`
- Modify `PRODUCT_MANIFEST.yaml`
- Modify `README.md`
- Create `docs/architecture/mcp-host-security.md`
- Modify `docs/plans/2026-07-17-electron-migration-implementation.md`
- Modify `scripts/verify-architecture.mjs`
- Modify `scripts/verify-repository.mjs`
- Modify packaged desktop smoke expectations

1. Run a real local official-SDK fixture exposing one tool, resource, and prompt. Prove initialization, discovery, strict normalization, cancellation/cleanup, and that no primitive is invoked.
2. Add executable gates for stable SDK generation, no Shell/package runner, exact one-use consent, environment isolation, named IPC/RPC, fixed budgets, disabled model/tool integration, and packaged UI visibility.
3. Mark only local stdio registry/consent/lifecycle/discovery capabilities implemented. Keep `mcp-host` in progress and remote HTTP/OAuth, execution, Agent/workflow use, subscriptions, and server-initiated model/user requests planned.
4. Run `volta run npm run verify`, inspect the full result, update this plan with evidence, stage only this slice, run `git diff --cached --check`, commit to `main`, and attempt push without touching legacy user work.
