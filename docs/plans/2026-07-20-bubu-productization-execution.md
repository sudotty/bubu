# BuBu productization execution contract

Status: active on `codex/bubu-productization` from the verified conversation-workbench tree.

## Product decision

BuBu is a local-first data-task agent. A dataset or group owns durable task threads; a thread owns the conversation, reviewed execution, recoverable state, results, evidence, and automation. The product is not a generic chatbot, BI dashboard, or cloud collaboration suite.

The primary journey remains:

`import → inspect → ask → review → approve → execute locally → use and preserve the result`

## Delivery contract

The prerequisite and every numbered stage end with one focused Git commit. A stage is complete only when runtime, tests, `PRODUCT_MANIFEST.yaml`, relevant README or product guidance, and current screenshots agree. Narrow checks run first; the final stage must pass `npm run verify`.

Unrelated local work under `AGENTS.md`, `bubu-bi/`, `.tasks/`, and `MVP.md` is outside this execution contract and must not be staged.

| Stage | Outcome | Required proof |
| --- | --- | --- |
| 0 | Establish an isolated, reviewable baseline and durable scope | branch, this contract, documentation verification |
| 1 | Replace the single compact breakpoint with content-driven wide, medium, and compact workbench modes; reduce object-management dominance | responsive screenshots, pane-state and overflow tests |
| 2 | Establish distinct visual and semantic grammar for user messages, assistant narrative, tool events, approvals, result previews, and recoverable errors | component tests, packaged chat screenshot |
| 3 | Make long tasks resumable and truthful across restart, failure, cancellation, and changed approval inputs | state derivation and recovery tests |
| 4 | Make Artifact usable through copy, current-view export, pinning, expansion, provenance, and message/result navigation | product/API tests and artifact smoke |
| 5 | Add deterministic chart suitability and accessible visual alternatives before a bounded local report bundle | pure recommendation tests and visual evidence |
| 6 | Turn Settings into an actionable health and recovery center with list-detail configuration | settings tests and screenshot |
| 7 | Enforce accessibility journeys and privacy-preserving local product metrics | keyboard/reflow gates, event-schema tests, no-content verifier |
| 8 | Add release readiness, migration retirement gates, aligned docs/screenshots, and full closure | signed-build capability truth, legacy verifier, `npm run verify` |

## Priorities and non-goals

The order is adaptive shell → conversation grammar → task reliability → result use → visualization → configuration recovery → observed quality → release. Hub, RBAC, sync, cloud sharing, model-driven MCP calls, unbounded multi-agent work, free-form dashboards, and a general WYSIWYG report editor remain outside this cycle.

## Product measures

Local metrics may record bounded event names, state transitions, durations, counts, and failure categories. They must never record question text, prompts, model output, credentials, file paths, row values, cell values, or Artifact contents.

The review uses these funnels without inventing unsupported targets:

- ask → reviewed plan → approval → local result;
- failure → recovery action → recovered result;
- result → Artifact open → copy/export/pin;
- saved task → restart → successful resume.

Guardrails remain exact: zero unapproved row disclosure, zero cross-thread workflow delivery, no generic renderer bridge, deterministic query authority in Go, and restorable local data.

## Release decision

The existing draft pull request is a frozen verified baseline and receives no more product scope. This branch becomes a separate review surface. Public beta remains blocked on signed and notarized macOS artifacts, signed update metadata, clean-device install/upgrade/recovery evidence, and an explicit disposition for every remaining `bubu-bi` migration slice.
