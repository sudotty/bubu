# BuBu Electron Migration and Product Completion Plan

**Status:** In progress
**Date:** 2026-07-17
**Architecture:** Electron shell + Node AI runtime + Go data core + optional Hub

## Definition of done

BuBu is complete when a new user can install it, import CSV/XLSX files, treat datasets as contacts or group participants, ask natural-language questions across one or more datasets, inspect and approve a privacy-safe plan, receive locally executed tables/charts/reports, save the operation as a reusable workflow, replace recurring data safely, and optionally collaborate through an explicitly configured Hub. Raw rows remain local unless a bounded disclosure is visibly approved.

Every claimed capability must have a runtime path, deterministic test, user documentation, and matching `PRODUCT_MANIFEST.yaml` state.

## Stage 0: Repository and decision contracts

- Add repository boundary rules and a machine-readable product manifest.
- Record Electron/Node/Go/Hub ADRs and threat boundaries.
- Add repository hygiene and secret gates.
- Establish root workspace commands that can become the single verification surface.

Exit: contracts describe the same target, tracked secrets/user databases are removed, and contract verification exits zero.

## Stage 1: Runnable Electron vertical slice

- Create the Electron Forge workspace and production packaging configuration.
- Enforce sandbox, context isolation, disabled Node integration, restrictive CSP, validated sender, denied navigation/popups/permissions, and hardened fuses.
- Expose a versioned typed preload API without generic IPC.
- Launch supervised Node AI and Go data-core processes through authenticated stdio RPC.
- Display process health and product readiness without exposing implementation channels.

Tests: pure command parsers, IPC authorization, RPC framing/version mismatch, process cancellation/crash recovery, production build, and packaged smoke launch.

## Stage 2: Local data kernel

- Move and simplify streaming CSV/XLSX import into the Go data core.
- Use authoritative monotonic migrations and transactional file/database staging.
- Implement immutable dataset versions, semantic columns, profiles, quality findings, replacement drift, relationships, validation, preview, export, and deletion.
- Make local storage paths configurable and portable without sharing a SQLite file between users.

Tests: temporary-database integration suites, malformed/large files, rollback, schema drift, multi-sheet workbooks, Unicode identifiers, cancellation, and migration upgrades.

## Stage 3: AI and privacy kernel

- Implement capability-negotiated OpenAI, Anthropic, Gemini, OpenAI-compatible, and Ollama providers.
- Store credentials through OS-backed secure storage; never log them.
- Build local classification, synthetic example generation, aggregates, exact disclosure previews, token/cost/time budgets, and an append-only usage ledger.
- Convert intent to a typed query plan; compile or validate SQL AST deterministically; run analysis read-only with limits.
- Stream progress and results while preserving cancellation and retry semantics.

Tests: provider contract fixtures, payload snapshots proving no raw-row leakage, malicious prompt/model output, SQL allow-list properties, budgets, fallbacks, and offline behavior.

## Stage 4: Data conversation product

- Replace the legacy dashboard with dataset contacts, dataset groups, and a conversation workspace.
- Persist messages, participants, tags, citations, plans, approvals, tables, charts, reports, exports, and errors as typed artifacts.
- Support lookups, joins, reconciliation, derived datasets, validation requests, business explanations, and suggested next questions.
- Render typed visualization specifications locally and keep the underlying query reproducible.

Tests: reducer/domain invariants, keyboard/accessibility, import-to-chat-to-chart end to end, multi-table joins, empty/error states, and responsive containment.

## Stage 5: Repeatable automation

- Implement versioned deterministic workflows, typed inputs/outputs, retries, cancellation, idempotency, checkpoints, approvals, schedules, and dataset-version triggers.
- Implement bounded agent steps with filtered tools and step/token/time/cost limits.
- Implement BuBu as an MCP host for stdio and Streamable HTTP tools/resources/prompts with isolation and consent.
- Implement local hybrid RAG for dictionaries, business rules, workflow docs, and user knowledge with citations.
- Implement recurring-file reminders and explicit replacement/version handling.

Tests: state-machine transitions, crash resume, idempotency, approval revocation, hostile MCP output, retrieval citations, schedule clock control, and bounded termination.

## Stage 6: Optional enterprise Hub

- Add explicit server opt-in, device pairing, users/groups, RBAC, policy distribution, audit, workflow sharing, and encrypted outbox-based synchronization.
- Keep raw dataset sharing separate from metadata/workflow sharing and require explicit grants.
- Use PostgreSQL in the Hub; never expose a shared SQLite file.
- Provide administrable conflict, revocation, offline, backup, and recovery behavior.

Tests: authorization matrix, protocol compatibility, sync conflicts, revoked queued work, offline recovery, encryption, and multi-device integration.

## Stage 7: Distribution and closure

- Migrate all useful vertical slices and delete Wails, broad OS command bindings, generated bridges, obsolete plans, duplicate docs, binaries, databases, uploads, and desktop metadata from version control.
- Finish macOS and Windows packaging, signing, update, backup, localization, accessibility, security, and performance gates.
- Publish user, administrator, privacy, provider, MCP, workflow, troubleshooting, backup, and recovery documentation.
- Run the complete verification surface, commit directly to `main`, push, and confirm clean local/remote state.

Exit: `npm run verify` and packaged smoke checks pass; the manifest contains no `legacy-*`, `broken`, or unverified `implemented` states; Wails references survive only in migration history.

## Execution rule

Work proceeds in vertical slices. Each slice starts with a failing deterministic check, crosses the smallest necessary process boundaries, updates documentation and the manifest, and is committed only after the full relevant gate passes. A visually convincing shell without its data, privacy, failure, and audit contracts is not product completion.

## Verified progress on 2026-07-17

| Stage | State | Verified product surface |
| --- | --- | --- |
| 0 | Complete | Repository, architecture, privacy, secret, dependency, and toolchain contracts |
| 1 | Complete | Secure packaged Electron shell with typed preload, authenticated Go/Node sidecars, and packaged launch smoke |
| 2 | Active | Atomic CSV/TSV/XLSX import, SQLite catalog, immutable replacement, drift blocking, type inference/profiles/preview, safe query compiler, and local 2–8-member dataset groups |
| 3 | Active | Schema-only/synthetic disclosure, encrypted credentials, provider registry/selection/tests, strict natural-language query plans, exact disclosure preview, explicit approval, and bounded local Go execution; streaming/ledger/multi-dataset privacy remain |
| 4 | Active | Dataset/group chat surfaces generate reviewable plans, local tables, and deterministic bar/time-series SVG charts; persistence, typed saved artifacts, tags, richer charts, and reports remain |
| 5–7 | Pending | Must not be represented as shipped; follow the exit criteria above |

The Stage 2 slice is exercised through Go integration tests and `npm run smoke:data-core`. Remaining Stage 2 work is interactive drift mapping, richer profiling, validation, multi-dataset relationships/joins, deletion, and export.
