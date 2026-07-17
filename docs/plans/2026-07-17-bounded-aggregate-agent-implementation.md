# Bounded Aggregate Agent Implementation Plan

> **Execution:** Test-drive every boundary on `main`, keep the Go data core authoritative, and do not stage the user-owned legacy Wails workspace.

**Goal:** Let a user run a useful plan-act-observe analysis over one already executed aggregate result, while proving that the model and its local tools cannot widen the exact disclosure or exceed fixed turn, tool, time, and output-token budgets.

**Architecture:** This is a narrow conversational agent run, not a generic autonomous worker. Electron main derives the same k>=5 aggregate disclosure from the exact persisted plan/result link, binds one short-lived approval to the provider destination and fixed budget, then drives a provider-neutral structured loop. The loop can invoke only pure local arithmetic tools over already approved cells. Every model turn uses the fail-closed disclosure ledger, and the successful typed run plus audit IDs is appended locally as an `insight` subtype. The pure runner and tool registry are reusable by a later durable workflow agent step; this slice does not let scheduled workflows bypass consent.

**Fixed budget:** At most 4 model turns, 3 local tool calls, 60 seconds wall time, 2,048 output tokens per turn, and 8,192 output tokens by construction. The allowed tools are aggregate row ranking, two-cell comparison, and numeric-column summary. There is no SQL, file, network, MCP, code, export, write, or renderer-defined tool.

**Tech stack:** TypeScript 7, Zod, React 19, Electron typed IPC, Node AI utility process, Go, SQLite, Vitest, and executable architecture gates.

---

## Task 1: Define strict agent decisions, tools, budgets, and run artifacts

**Files:**

- Create `packages/contracts/src/aggregate-agent.ts`
- Create `packages/contracts/src/aggregate-agent.test.ts`
- Modify `packages/contracts/src/aggregate-explanation.ts`
- Modify `packages/contracts/src/conversation.ts`
- Modify `packages/contracts/src/index.ts`

1. Write failing tests for strict prepare/proposal/approval contracts, the literal fixed budget, the three-tool discriminated union, tool observations, finish reports, cell evidence, bounded traces, and rejection of extra authority fields.
2. Extract only the already shared approval-token/model-destination schemas from the aggregate explanation contract.
3. Make the successful agent run a second strict `insight` payload shape rather than adding an arbitrary conversation blob or a renderer-controlled role.
4. Re-run targeted and full contract tests.

## Task 2: Implement the pure least-privilege tool registry

**Files:**

- Create `apps/desktop/src/main/aggregate-agent-tools.ts`
- Create `apps/desktop/src/main/aggregate-agent-tools.test.ts`

1. Write failing tests for rank, compare, and numeric-column-summary behavior over exact approved cells.
2. Reject out-of-range coordinates, text/boolean/null operands, non-finite arithmetic, unknown tools, oversized ranking requests, and any input field not in the strict contract.
3. Return only cell references and deterministic values derived from the disclosure; never return a dataset ID, source path, query plan, SQL, provider credential, or wider row.
4. Add property-style assertions that every returned row/column reference resolves inside the supplied disclosure.

## Task 3: Implement and terminate the structured agent loop

**Files:**

- Create `apps/desktop/src/main/aggregate-agent-runner.ts`
- Create `apps/desktop/src/main/aggregate-agent-runner.test.ts`
- Modify `apps/desktop/src/main/analysis-orchestrator.ts`
- Modify `apps/desktop/src/main/analysis-orchestrator.test.ts`

1. Write failing tests for tool -> observation -> finish, immediate finish, malformed model output, fourth tool rejection, turn exhaustion, global timeout, cancellation, and exact evidence validation.
2. Build every provider message from only the approved disclosure, fixed catalog, goal, and prior bounded observations. Label all model/disclosure/tool text untrusted and expose no native provider tools.
3. Parse exactly one JSON decision per turn. Re-filter and validate the requested tool before every execution.
4. Combine the caller signal with one 60-second global timeout and stop after the fixed turn/tool limits without retrying beyond the budget.

## Task 4: Extend fail-closed audit correlation without repeated enum-table rebuilds

**Files:**

- Modify `packages/contracts/src/model-audit.ts`
- Modify `packages/contracts/src/model-audit.test.ts`
- Modify `apps/desktop/src/main/model-audit.ts`
- Modify `apps/desktop/src/main/model-audit.test.ts`
- Modify `services/data-core/internal/data/model_audit_*`
- Modify `services/data-core/internal/data/migrations.go`

1. Write failing TypeScript and Go tests for the `aggregate-agent` purpose with aggregate-only scope.
2. Add a monotonic migration that supports the new audited purpose while preserving all prior request/outcome rows and version 9-11 backup compatibility.
3. Return the completed audit identity from an internal audited-generation variant so each successful agent turn can cite its append-only ledger event; keep existing callers' completion-only API unchanged.
4. Keep raw-row, synthetic-row, target/source-count, row-count, endpoint-origin, and payload-budget validation fail-closed for every turn.

## Task 5: Add capability-bound approval and typed desktop orchestration

**Files:**

- Create `apps/desktop/src/main/aggregate-agent-approval-sessions.ts`
- Create `apps/desktop/src/main/aggregate-agent-approval-sessions.test.ts`
- Modify `apps/desktop/src/main/analysis-api.ts`
- Modify `apps/desktop/src/main/desktop-api.ts`
- Modify `apps/desktop/src/shared/product-api.ts`
- Modify `apps/desktop/src/preload.ts`

1. Write failing tests proving the token is 256-bit, expires in ten minutes, is one-use, binds the exact goal/disclosure/destination/fixed budget, and is isolated from explanation approvals.
2. Prepare only from the exact persisted reviewed plan/result pair and the user-entered goal; the renderer cannot submit rows, tools, or budgets.
3. Consume approval before provider I/O, re-resolve and compare the destination, run through the audited loop, and append only a validated successful insight or bounded error.
4. Keep the preload narrow: prepare, approve, dismiss, and existing named cancellation only.

## Task 6: Build the exact review, running trace, and historical result UI

**Files:**

- Create `apps/desktop/src/renderer/AggregateAgentPanel.tsx`
- Create `apps/desktop/src/renderer/AggregateAgentCard.tsx`
- Create `apps/desktop/src/renderer/AggregateDisclosurePreview.tsx`
- Modify `apps/desktop/src/renderer/AggregateExplanationPanel.tsx`
- Modify `apps/desktop/src/renderer/DatasetAnalysis.tsx`
- Modify `apps/desktop/src/renderer/DatasetGroupAnalysis.tsx`
- Modify `apps/desktop/src/renderer/ConversationHistory.tsx`
- Modify `apps/desktop/src/renderer/styles.css`

1. Reuse one exact disclosure-preview component for simple explanation and agent review so destination, question, purpose, every cell, expiry, and k>=5 policy cannot drift.
2. Show the immutable budget and allowed tools before a distinct approval click; provide dismissal and operation cancellation.
3. Render the final report as text with resolved cell citations plus a compact local trace of turns, tool calls, observations, and audit IDs.
4. Do not render model HTML, hidden chain-of-thought, credentials, paths, raw provider bodies, or an editable tool catalog.

## Task 7: Add durable product contracts and end-to-end proof

**Files:**

- Modify `PRODUCT_MANIFEST.yaml`
- Modify `README.md`
- Modify `docs/architecture/privacy-and-model-providers.md`
- Modify `docs/architecture/local-conversations.md`
- Modify `docs/product/repeatable-workflows.md`
- Modify `docs/plans/2026-07-17-electron-migration-implementation.md`
- Modify `scripts/verify-architecture.mjs`
- Modify `scripts/verify-repository.mjs`
- Modify `scripts/smoke-data-core.mjs`

1. Add fitness gates for fixed budgets, filtered pure tools, termination, one-use capability isolation, audited turns, exact review, typed persistence, and absence of generic preload/tool authority.
2. Extend data-core smoke/backup evidence for the new typed insight/audit purpose without making a live paid provider request.
3. Mark only `bounded-aggregate-agent-runs` implemented. Keep reusable agent definitions, workflow agent steps, MCP, RAG, side effects, cost pricing, and broad `bounded-agents` in progress/planned.
4. Run `volta run npm run verify`, inspect the full result, stage only this slice, run `git diff --cached --check`, commit to `main`, and attempt push without touching legacy user work.
