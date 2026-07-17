# Privacy-Safe Aggregate Explanations Implementation Plan

> **Execution:** Use test-driven development and the existing main-only BuBu execution contract. Do not create a branch or worktree.

**Goal:** Let a user ask the configured model to explain an already executed aggregate result only after inspecting and explicitly approving the exact bounded payload.

**Architecture:** Go remains the authority for query execution and the append-only disclosure ledger. Electron main derives a disclosure candidate only from a reviewed plan and its persisted immutable result, enforces a k-anonymity-style floor, holds a short-lived one-use approval token, and performs the audited provider request. The sandboxed renderer can preview and approve that candidate but cannot construct or widen it.

**Tech stack:** TypeScript 7, Zod, React 19, Electron typed IPC, Node AI utility process, Go, SQLite, Vitest, Go integration tests.

**Status:** Complete and fully verified on 2026-07-17. `volta run npm run verify` passed contracts (51 tests), AI runtime (16), desktop (43), all Go packages, type checks, dependency audit, production packaging, data-core and packaged-desktop smoke tests, and the 100 MiB performance gate (183,246 rows; 4.09 s import/profile; 184.81 ms query p95; 37.02 MiB peak RSS).

---

## Task 1: Define strict aggregate disclosure and explanation contracts

**Files:**

- Create `packages/contracts/src/aggregate-explanation.ts`
- Create `packages/contracts/src/aggregate-explanation.test.ts`
- Modify `packages/contracts/src/index.ts`
- Modify `packages/contracts/src/privacy.ts`

1. Write failing contract tests for a maximum of 50 rectangular aggregate rows, a minimum group size of five, bounded cells, strict one-use approval requests, strict structured explanations, and evidence references that must resolve to disclosed row/column coordinates.
2. Run `volta run npm test -w @bubu/contracts -- aggregate-explanation.test.ts` and confirm failure because the contract does not exist.
3. Implement the smallest strict Zod schemas and parsers. Keep model-context disclosure limited to schema-only/schema-synthetic while adding `aggregates` only to the broader audited disclosure vocabulary.
4. Re-run the targeted contract test and the full contracts suite.

## Task 2: Implement the pure disclosure policy and approval session boundary

**Files:**

- Create `apps/desktop/src/main/aggregate-disclosure.ts`
- Create `apps/desktop/src/main/aggregate-disclosure.test.ts`
- Create `apps/desktop/src/main/aggregate-approval-sessions.ts`
- Create `apps/desktop/src/main/aggregate-approval-sessions.test.ts`

1. Write failing policy tests proving that only plans containing `COUNT(*)` qualify, every disclosed row has a numeric count of at least five, minimum/maximum measures are rejected, at most 50 rows cross the boundary, and group results retain immutable source identities.
2. Write failing session tests proving a token expires after ten minutes, is consumed once, and cannot be used to substitute a different payload.
3. Run the targeted tests and confirm expected missing-module failures.
4. Implement pure candidate derivation plus a bounded in-memory store of at most 20 pending approvals.
5. Re-run the targeted tests.

## Task 3: Extend the fail-closed ledger for aggregate disclosures

**Files:**

- Modify `packages/contracts/src/model-audit.ts`
- Modify `packages/contracts/src/model-audit.test.ts`
- Modify `apps/desktop/src/main/model-audit.ts`
- Modify `apps/desktop/src/main/model-audit.test.ts`
- Modify `services/data-core/internal/data/migrations.go`
- Modify `services/data-core/internal/data/model_audit_types.go`
- Modify `services/data-core/internal/data/model_audit_validation.go`
- Modify `services/data-core/internal/data/model_audit_store.go`
- Modify `services/data-core/internal/data/model_audit_test.go`
- Modify `services/data-core/internal/data/backup_model_audit_validation.go`
- Modify `services/data-core/internal/data/service_test.go`

1. Write failing TypeScript and Go tests for `aggregate-explanation`, `aggregates`, and an explicit aggregate row count; reject aggregate scopes with synthetic rows, missing rows, wrong target counts, or raw-row claims.
2. Confirm both test suites fail before implementation.
3. Add monotonic migration 10, keeping request rows immutable and terminal outcomes one-time append-only.
4. Make backup validation schema-version aware so version 8/9 backups remain restorable while version 10 validates aggregate counts.
5. Re-run targeted TypeScript and Go tests.

## Task 4: Build the audited explanation request and typed desktop API

**Files:**

- Modify `apps/desktop/src/main/analysis-orchestrator.ts`
- Modify `apps/desktop/src/main/analysis-orchestrator.test.ts`
- Modify `apps/desktop/src/main/analysis-api.ts`
- Modify `apps/desktop/src/main.ts`
- Modify `apps/desktop/src/main/desktop-api.ts`
- Modify `apps/desktop/src/shared/product-api.ts`
- Modify `apps/desktop/src/preload.ts`
- Modify `packages/contracts/src/conversation.ts`
- Modify `services/data-core/internal/data/conversation.go`

1. Write failing orchestrator tests for a prompt that labels aggregate values as untrusted data, exposes no credentials or file paths, requires strict JSON, and validates every evidence reference.
2. Add a typed prepare command that locates the exact persisted result produced from the reviewed plan and returns an opaque approval token plus the exact disclosure preview.
3. Add a typed approve command that consumes the token before provider I/O, records the ledger start before the request, validates the structured completion, and appends a typed insight artifact to the local conversation.
4. Do not expose a renderer conversation-write method, generic IPC, reusable approval, or model-selected disclosure level.
5. Run desktop tests and TypeScript lint.

## Task 5: Add the visible review and explanation experience

**Files:**

- Create `apps/desktop/src/renderer/AggregateExplanationPanel.tsx`
- Modify `apps/desktop/src/renderer/DatasetAnalysis.tsx`
- Modify `apps/desktop/src/renderer/DatasetGroupAnalysis.tsx`
- Modify `apps/desktop/src/renderer/ConversationHistory.tsx`
- Modify `apps/desktop/src/renderer/styles.css`

1. Show the exact columns and every outbound aggregate row before approval, the minimum group-size policy, provider-bound warning, expiry, and a cancel path.
2. Require a distinct approval click; show progress and named cancellation while the provider request is active.
3. Render summary, findings, resolved evidence references, caveats, and suggested next questions as local typed UI, never model HTML.
4. Explain why a detail query, small group, minimum/maximum result, or count-free result cannot be sent.
5. Run desktop tests, type checks, and packaged renderer smoke.

## Task 6: Add end-to-end evidence and durable product contracts

**Files:**

- Modify `scripts/smoke-data-core.mjs`
- Modify `scripts/verify-architecture.mjs`
- Modify `scripts/verify-repository.mjs`
- Modify `PRODUCT_MANIFEST.yaml`
- Modify `README.md`
- Modify `docs/architecture/privacy-and-model-providers.md`
- Modify `docs/plans/2026-07-17-electron-migration-implementation.md`

1. Extend the data-core smoke and backup/restore path to cover a valid aggregate disclosure audit without storing payload values.
2. Add architecture gates for one-use approval, k>=5, count requirement, 50-row cap, audited-only provider invocation, strict evidence validation, and no generic preload event/write authority.
3. Mark only the narrow aggregate-explanation capabilities implemented; keep explicit rows and bounded agents in progress/planned until their independent gates pass.
4. Run `volta run npm run verify` and read the complete output.
5. Stage only the Electron/data-core/contracts/docs paths, run `git diff --cached --check`, commit directly to `main`, and attempt push only after local verification remains green.
