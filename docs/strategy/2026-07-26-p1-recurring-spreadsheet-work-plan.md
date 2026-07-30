# P1 recurring spreadsheet work execution plan

Status: **Completed and verified against the executable product contract**

Date: 2026-07-26

Authority: this plan defines proposed sequence and acceptance criteria. Runtime behavior, tests, current product documentation, executable verifiers, and `PRODUCT_MANIFEST.yaml` remain the delivery truth.

Progress snapshot: **P1.1 through P1.7 are completed.** In addition to the reviewed deterministic Clean kernel and versioned quality proof, source activation now atomically enqueues idempotent downstream replay. The Go authority validates the active dependency graph, advances chains topologically without a model call, pauses on drift or blocking quality, recovers interrupted tasks, and exposes bounded retry/cancel. Terminal evidence appears in the target's local conversation, the lineage surface, and privacy-safe desktop notifications. Five editable templates and the packaged blocked-to-remediated recurring journey complete the product slice.

## 1. Product outcome

P1 turns BuBu from a trustworthy analysis workspace into a complete recurring spreadsheet-work product:

> Import the next file, apply a reviewed cleanup recipe, detect meaningful drift, produce a versioned output, and deliver the result without asking the model to rediscover deterministic work.

The primary journey is BuBu Clean:

```text
new CSV/XLSX version
-> schema and quality impact preview
-> reviewed typed transformation plan
-> local deterministic execution
-> versioned derived data object
-> quality gate and evidence
-> workflow delivery to the owning task
-> repeat on the next compatible version
```

Success means a user can complete that journey in the packaged desktop app with synthetic retail data and understand what changed, what ran, what failed, and what can safely run again.

## 2. Priority order

| Priority | Capability | Why it comes now | Completion evidence |
| --- | --- | --- | --- |
| P1.1 | Complete typed transformation grammar | Cleanup value depends on safe deterministic operations | Contract parsers, pure validation, Go execution tests, rejected-plan tests |
| P1.2 | Transformation impact preview | Users must see affected columns, rows, and risks before execution | Renderer flow plus packaged approval and cancel journey |
| P1.3 | Versioned Clean materialization | Cleanup must produce a reusable local object, not a transient table | Immutable output, plan fingerprint, lineage, backup/restore regression |
| P1.4 | Quality gates and completion evidence | A successful process is not the same as a trustworthy output | Before/after checks, blocking policy, proof card, audit evidence |
| P1.5 | Automatic derived recompute | Completes recurring work without model rediscovery | Dataset-version trigger, compatible-input fast path, drift pause path |
| P1.6 | Workflow delivery and recovery | Recurring work needs durable status and actionable failure handling | Restart recovery, retry/cancel, task delivery, privacy-safe OS notice |
| P1.7 | BuBu Clean templates and demo | The capability needs a legible entry point and repeatable sales/product proof | Template chooser and packaged end-to-end demo |

P1.1 through P1.4 form the first releasable vertical slice. P1.5 through P1.7 complete the recurring-job promise.

## 3. Capability design

### 3.1 Typed transformation plan

Extend the versioned contract with a discriminated operation union. The initial grammar is deliberately bounded:

- select and reorder columns;
- rename columns;
- cast values with explicit invalid-value policy;
- replace exact values and normalized text values;
- derive a column from a whitelisted expression grammar;
- filter with typed predicates;
- remove duplicates with explicit keys and keep policy;
- fill missing values with a literal or approved aggregate;
- append compatible inputs;
- union inputs with an explicit column mapping.

Every operation must declare input columns, output columns, null behavior, expected type, and failure policy. Unknown operations, undeclared columns, arbitrary SQL, code, regexes without budgets, and implicit lossy casts fail closed at the contract boundary.

The pure product core owns plan summaries, risk classification, and user-facing impact descriptions. The Go data core remains the final validator and executor.

### 3.2 Impact preview and approval

Before materialization, the product shows:

- source object and immutable version;
- ordered operation list in business language;
- columns added, removed, renamed, or type-changed;
- bounded counts for rows filtered, deduplicated, filled, or rejected;
- sample-free default disclosure, with local-only affected-value examples when useful;
- quality rules that will block or warn;
- destination name and version behavior.

Approval is one-use and binds the exact plan fingerprint, source versions, destination identity, impact summary, and quality policy. Any mutation requires a new preview and approval.

Implemented P1.2 scope: the packaged renderer exposes an editable builder for column selection/reordering, keyed deduplication, compatible append, and reference coverage checks. The Go preview boundary executes the complete P1.1 grammar without writing, so every operation reports before/after row counts, ordered columns, and affected-row counts. The UI binds destination name, exact typed plan, immutable source versions, complete impact result, and SHA-256 plan fingerprint into a ten-minute one-use Electron approval. Closing or editing revokes the pending review; stale source versions and direct unreviewed Data Clean materialization fail closed.

### 3.3 Versioned materialization and lineage

Execution creates or advances a derived data object transactionally. A version records:

- all parent object and version identifiers;
- transformation-plan version and fingerprint;
- operation-level row counts and warnings;
- quality-gate result;
- execution and audit identifiers;
- whether execution used a reviewed replay or a newly proposed plan.

Failed work must not activate a partial version. Backup, restore, export, deletion, and chained derivation must preserve the same authority rules as the existing derived-object baseline.

Implemented P1.3 scope: schema migration 20 adds bounded execution-evidence columns to every derived lineage version. New Data Clean materialization is rejected by the Go authority unless it carries a recent one-use review whose SHA-256 fingerprint matches the exact transformation. Manual recompute stores a new execution ID and `reviewed-recompute` origin. Legacy versions remain readable without inventing historical evidence.

Implemented P1.4 scope: schema migration 21 adds versioned quality policies and evidence plus a bounded blocked-attempt audit. The policy grammar covers row count, non-null thresholds, composite uniqueness, accepted values and inferred types, relationship coverage, and aggregate variance; every rule is explicitly blocking or warning. Preview shows the exact outcome and policy fingerprint. The Go authority recomputes the policy before every initial activation and immutable recompute: blocking results create no dataset/version, warning results activate with visible warnings, and passing results carry a compact rule-level proof. Backup validation rejects mismatched plan, policy, impact, or quality fingerprints.

### 3.4 Quality gate

Users can attach bounded checks to a Clean recipe:

- required columns and accepted types;
- non-null thresholds;
- uniqueness constraints;
- row-count and aggregate variance limits;
- accepted categorical values;
- relationship coverage for mapped reference data.

Checks are classified as blocking or warning. A blocking failure pauses activation and workflow delivery, preserves diagnostic evidence, and offers retry after mapping or plan revision. It never silently promotes a failed output.

### 3.5 Automatic recompute

The existing manual immutable recompute becomes the reference implementation for automation:

1. a source dataset version is activated;
2. the Go data core finds dependent active derived objects;
3. compatible plans enqueue idempotent recompute operations;
4. incompatible schema or failed quality checks pause the dependency;
5. successful results activate a new immutable version;
6. downstream dependents run in topological order;
7. cycles, duplicate trigger keys, and stale parent versions fail closed;
8. the owning task receives completion or remediation evidence.

The model is not called on the compatible replay path. Schema drift may request a bounded plan revision only after explicit user review.

### 3.6 Clean templates

Ship a small set of editable, local templates rather than a generic automation gallery:

- customer-list cleanup and deduplication;
- ecommerce order normalization;
- monthly report input preparation;
- append weekly exports with schema checks;
- reference-data mapping with unmatched-value evidence.

Templates instantiate typed drafts; they do not bypass preview, approval, quality, or privacy controls.

Implemented P1.5–P1.7 scope: migration 22 adds a bounded durable recompute queue keyed by trigger source version and target. Active lineage edges form the dependency graph; graph budgets and cycle detection fail closed before processing. Successful activation enqueues direct dependents in the same transaction, and each successful derived version enqueues its next level, yielding deterministic topological progression. Running tasks recover to pending on startup. Quality blocks, incompatible schema, stale parents, cancellation, and execution errors retain distinct terminal evidence; retry is capped at three attempts. The renderer polls only the Go-owned queue, shows remediation actions, and receives no raw-row diagnostics. The template catalog covers monthly preparation, customer deduplication, order normalization, identical-schema append, and reference-data coverage evidence. The packaged journey proves a deliberate quality pause followed by a corrected source and exactly one next Clean version.

## 4. Delivery slices

### Slice A: contract and deterministic kernel

- Add versioned transformation contracts and generated bindings.
- Implement pure plan validation, summaries, risks, and fingerprints.
- Implement Go execution with transaction boundaries and bounded resource budgets.
- Add table-driven positive, malformed, lossy, cancellation, and rollback tests.

Exit gate: contracts and Go agree on every operation; no renderer or model path can execute an unparsed plan.

### Slice B: reviewed Clean task

- Add a concrete Clean entry point from a data object and the empty-task starters.
- Render the operation plan and local impact preview.
- Bind one-use approval to the full execution envelope.
- Materialize and open the resulting derived object with lineage and evidence.

Exit gate: the packaged app completes and cancels a real Clean task without hidden capability or static fixture substitution.

### Slice C: quality and proof

- Add reusable blocking and warning policies.
- Compare before/after quality and operation counts.
- Add a compact proof card to the task and artifact workspace.
- Preserve evidence through backup and restore.

Exit gate: a failing quality rule prevents activation and gives one clear remediation route; a passing run proves its source versions and checks.

### Slice D: recurring replay

- Add dependency discovery and topological recompute in the Go authority.
- Reuse workflow trigger persistence, idempotency, cancellation, retry, and restart recovery.
- Add compatible replay, drift pause, and downstream-chain tests.
- Deliver completion/failure to the owning task and OS notification without raw data.

Exit gate: replacing the retail source file automatically produces the next derived version with zero model calls; incompatible drift pauses safely.

### Slice E: templates and P1 product proof

- Add the bounded Clean template catalog and editable drafts.
- Extend the retail demo with a dirty next-period file and a cleanup recipe.
- Add packaged screenshots and an end-to-end journey covering preview, approval, output, replacement, replay, and drift remediation.
- Align current product docs, Manifest states, and verifier assertions.

Exit gate: a first-time user can discover the job, finish it, repeat it, and inspect evidence without reading architecture documentation.

## 4.1 Completed execution arrangement after P1.4

The remaining slices were completed in this dependency order:

1. **P1.5a — dependency index and fail-closed graph.** Derive active edges from version lineage, reject cycles, resolve current source versions, and expose a deterministic topological replay plan. This is the next implementation slice because both automation and delivery depend on one authoritative graph.
2. **P1.5b — idempotent automatic replay.** On source-version activation, create a durable trigger keyed by source version plus derived target, replay the stored plan and quality policy with zero model calls, activate only passing/warning output, and deduplicate repeated signals.
3. **P1.5c — drift and downstream pause.** Distinguish incompatible schema, stale parent, quality block, cancellation, and transient execution failure. Pause the affected branch, retain evidence, and never run downstream nodes after an upstream pause.
4. **P1.6a — recovery lifecycle.** Reuse workflow trigger persistence for restart recovery, bounded retry, cancellation, and terminal state. Do not introduce a second scheduler or execution authority.
5. **P1.6b — task and notification delivery.** Attach success or remediation evidence to the owning conversation/task and emit only privacy-safe OS notification text. The version proof remains the canonical detail surface.
6. **P1.7a — editable template catalog.** Start with customer deduplication, order normalization, and monthly preparation; add append and reference mapping only after multi-source replay is green.
7. **P1.7b — packaged recurring proof.** The packaged synthetic journey now performs a next-period replacement, automatic replay, deliberate quality pause, remediation, and proof inspection before emitting its success marker.

The completed dependency order was **P1.5 graph correctness → replay idempotency → pause/recovery → delivery → templates**. P1.7 consumes the same typed plans and quality policies and does not contain a template-specific executor.

## 5. Verification contract

Each slice starts with a failing behavior test. P1 is complete only when all of the following are fresh and green:

- contract and product-core unit tests;
- `go test ./...` for the complete data-core module;
- malformed boundary payload, approval tamper, cancellation, rollback, and restart tests;
- chained X -> Y recompute and cycle rejection;
- backup/restore of transformation definitions, quality policies, lineage, and inactive failures;
- renderer interaction tests for preview, approval, failure remediation, and evidence;
- packaged Clean and automatic-replay journey with synthetic files;
- dependency, architecture, privacy, documentation, repository, and product-experience gates;
- root `npm run verify`.

Every delivered capability must move from planned or in-progress to implemented in `PRODUCT_MANIFEST.yaml` only in the same change that supplies runtime, documentation, tests, and verifier evidence.

## 6. Product metrics and guardrails

Measure locally without recording filenames, values, questions, SQL, or model text:

- time from import to first Clean output;
- preview-to-approval completion rate;
- percentage of replays completed with zero model calls;
- schema-drift pause rate and recovery rate;
- quality-gate failure and remediation rate;
- recurring workflow completion rate;
- median user actions required to repeat a prior job.

Guardrails:

- zero remote raw rows by default;
- zero unapproved transformation executions;
- zero partial active versions after failure;
- no automatic plan revision after drift;
- no second execution authority outside the Go data core;
- no template that claims an unavailable operation.

## 7. Explicit non-goals

P1 does not include a general spreadsheet editor, arbitrary formulas or code, free-form SQL, cloud sync, Hub dependency, team RBAC, broad connectors, autonomous multi-agent execution, or signed public installers. These remain separate product and release decisions and must not block the local recurring-work vertical slice.

## 8. Completed start condition

Implementation started from the verified P0 closure baseline. Contract fixtures and failing Go behavior tests preceded the UI work, and final closure requires root tests, lint, build, packaged smoke, dependency audit, Go tests, and `npm run verify` to pass together.
