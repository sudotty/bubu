# Approved MCP Prompt Get Implementation Plan

> **Execution:** Test-drive every boundary on `main`; treat prompt arguments as an explicit disclosure to local code and returned messages as untrusted local data, never model instructions.

**Status:** Active.

**Goal:** Let a user choose one prompt discovered during an approved local stdio MCP inspection, fill only its declared string arguments, review every exact value and process detail, approve one bounded `prompts/get`, and inspect normalized messages locally without automatically sending them to a model, conversation, Agent, or workflow.

**Architecture:** The renderer derives an argument form only from the current bounded discovery snapshot and exposes named prepare/approve/dismiss/list-audit operations. Electron main validates the declared argument set, reconstructs the canonical secret-bearing launch, stores only one-use fingerprints in memory, writes a content-free append-only audit, and routes cancellation. The Node AI utility starts a new official-SDK client, re-discovers the exact prompt and argument contract within bounds, calls `getPrompt` once, normalizes all supported content blocks under decoded/serialized budgets, removes `_meta` and annotations, and closes in `finally`.

**Fixed limits:** 20 pending approvals, 10-minute one-use lifetime, 20 argument entries, 4 KiB per value, 16 KiB combined argument payload, 30-second deadline, five discovery pages, 100 prompts, 20 returned messages, 256 KiB decoded content, and 384 KiB serialized result. Oversize or malformed data fails closed and is never silently truncated.

**Content policy:** Text is escaped local-only display. Image/audio/base64 and embedded binary content is decoded only inside the AI utility and reduced to type, MIME, bytes, and SHA-256. Embedded text can display as escaped text. Resource links return only bounded metadata. No binary bytes, `_meta`, annotations, SDK object, stderr, prompt output, or argument value enters persistent audit or a model.

**Deliberate exclusions:** No prompt completion, arbitrary prompt name/argument key, saved prompt preset, prompt-to-model action, conversation insertion, resource-link follow, tool call, Agent/workflow registration, remote transport, OAuth, sampling, elicitation, or subscription.

---

## Task 1: Define prompt request, approval, result, and audit contracts

- Modify `packages/contracts/src/mcp.ts` and `mcp.test.ts`.
- Add strict prompt name/argument/value/combined-byte budgets, a fixed proposal and invocation, and a local-only/untrusted result union for text, binary metadata, embedded text/blob metadata, and resource links.
- Generalize MCP audit starts/events into resource-read and prompt-get discriminated unions without making illegal operation-specific states representable.
- Prove result/accounting exactness, no raw binary, no `_meta`, and no prompt argument value in audit contracts.

## Task 2: Generalize append-only MCP audit persistence

- Modify `apps/desktop/src/main/mcp-audit-store.ts` and its tests.
- Persist the operation-specific strict start union and existing success/failure outcome, preserving immutable start/outcome files, capacity, corruption rejection, in-process/in-restart states, and recent bounded reads.
- Record prompt name, ordered argument keys, total UTF-8 argument bytes, and a value-free public request fingerprint; never record argument values or prompt result content.

## Task 3: Add secret-bound one-use prompt approval

- Create `apps/desktop/src/main/mcp-prompt-approval-sessions.ts` and tests.
- Bind name, canonical launch, decrypted environment, exact prompt name, exact argument values, and fixed budgets in an in-memory launch fingerprint.
- Keep the persistent-audit fingerprint value-free; preparing/dismissing performs zero utility I/O, exact expiry is invalid, and all post-review drift forces a new review.

## Task 4: Implement official-SDK prompt materialization

- Modify `services/ai-runtime/src/mcp/client.ts`, tests, and the real fixture.
- Re-list within five pages/100 prompts, require exact prompt name, exact declared argument keys, all required values, and no unknown values before one `client.getPrompt` site.
- Normalize at most 20 messages/256 KiB; escape text, hash binary, keep link metadata only, discard annotations/`_meta`, and close on success/error/timeout/cancel.
- Prove exact fixture invocation and zero resource/tool/subscription authority in prompt tests.

## Task 5: Add named RPC and audited Electron orchestration

- Modify AI handler/dispatcher tests and code, desktop sidecar client, shared product API, preload, and desktop API.
- Create `apps/desktop/src/main/mcp-prompt-api.ts` and tests.
- Consume approval, re-resolve/fingerprint, append audit start before I/O, invoke the single named method, append exactly one normalized terminal outcome, and return only the strict result.

## Task 6: Build exact argument disclosure review and local result UI

- Modify `McpSettings.tsx`, styles, and packaged smoke expectations.
- Build argument inputs from discovered prompt metadata only; block missing required and unknown arguments.
- Review canonical executable, all arguments, environment key names, prompt name, every prompt argument value, expiry, and limits before a second approval click.
- Render returned blocks and audit metadata as text only, with clear local-only/untrusted labels and cancel/dismiss/retry behavior.

## Task 7: Close contracts and verification

- Extend real MCP smoke, architecture/repository gates, manifest, README, MCP security contract, migration plan, and this plan.
- Require exactly one policy-bound `getPrompt` site, exactly one existing resource-read site, no tool/subscription methods, value-free audit, secret-bound drift, named APIs, safe UI, and docs/status agreement.
- Mark only `mcp-prompt-get` implemented; keep prompt-to-model/tool/Agent/workflow and remote MCP planned.
- Run `volta run npm run verify`, record evidence, stage only this slice, commit directly to `main`, push, and confirm remote alignment without touching legacy Wails work.
