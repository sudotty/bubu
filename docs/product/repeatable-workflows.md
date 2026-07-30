# Repeatable Workflows

External reminders are optional and version-bound. A workflow can bind one encrypted HTTPS Webhook destination only when its final node is `human-approval`; only the explicitly approved successful run emits the minimal signed status/Artifact/open-hint payload. Delivery never includes raw rows, questions, model content, result tables, credentials, or local paths, and it records bounded retry/final-failure evidence. See [external delivery reminders](external-delivery-reminders.md).

BuBu can save an already generated and reviewed single-dataset or group query plan as a reusable local workflow. This turns a repeated spreadsheet question into a named, versioned operation without persisting model-generated SQL or broad tool authority.

## Save and run

After BuBu displays a query or join plan, open the top-right **工作流** drawer and select **保存为工作流**. Electron main verifies that every step exactly matches a plan in the local conversation before sending the strict workflow definition to the Go data core.

A workflow contains 1–8 ordered steps. Query steps remain read-only, carry a stable local name, and have 1–3 attempts. An optional `human-approval` step has exactly one attempt, a visible title and next action, low/medium/high risk, and a 5-minute to 24-hour expiry. The complete active execution has a 1-second to 10-minute deadline; waiting for a person is durable state rather than a blocked query. Unknown step kinds, arbitrary commands, SQL, duplicate step names, target drift, oversized plans, and extra JSON fields are rejected.

Before saving, choose one trigger: manual only, daily, weekly, monthly, or after the target data version changes. The adjacent **交付前必须人工批准** control adds the named approval node; it never turns an old interactive approval into workflow authority. Calendar choices use the device's IANA timezone and start from a visible 09:00 local default. The user can change the exact time, weekday, or day of month before saving; the adjacent description always states the exact trigger that will be persisted. Business-topic cadence preselects the same workflow trigger. For a group, the version signature includes every member identity and current immutable version in saved order. Older interval definitions remain compatible; new calendar definitions calculate the next real calendar occurrence rather than approximating a month as 30 elapsed days.

On each run, BuBu:

1. creates or finds the run by its UUID idempotency key;
2. loads the exact saved definition version;
3. rebinds a dataset plan to that contact's current immutable version;
4. for a group plan, keeps the saved member identities/order and rebinds only their current versions;
5. executes through the same Go safe-query compiler used by interactive analysis;
6. writes an append-only attempt checkpoint with resolved input, typed result or bounded error;
7. when present, creates one pending approval bound to the workflow ID and definition version, durable run, node ordinal and ID, exact target, risk, action, request time, and expiry;
8. returns `awaiting-approval` without executing later steps, or marks the run succeeded, failed, or cancelled when terminal.

Repeating the same run command with the same idempotency key returns the prior run instead of duplicating work. A compatible recurring-file replacement is therefore picked up automatically. A missing column, changed group membership/order, unsafe join, stale target, or other policy violation fails visibly rather than silently changing meaning.

## Local persistence and lifecycle

Definitions, runs, attempts, resolved version identities, bounded results, approvals, decisions, and errors live in the local SQLite database. Active definitions are limited to 500, each definition to eight steps, each workflow to 10,000 retained runs, and each persisted input/result to 1 MiB. The UI reads at most the latest 50 runs and 100 pending approvals.

Removing a workflow soft-deletes the active definition but retains its run audit. Permanently deleting a dataset retires workflows targeting that dataset and every affected group. Deleting a group retires its workflows. Data backup and restore include definitions, runs, checkpoints, approval bindings, decisions, and expiry evidence; restore rejects mismatched definitions, targets, runs, nodes, or terminal states before installation.

## Human approval and safe resume

At an approval node, the Go data core persists the node checkpoint and approval request atomically. The renderer shows the definition version, run prefix, node and ordinal, target, exact next action, risk, and expiry. **批准并恢复同一运行** consumes only that pending request, writes an `approved` checkpoint result, and continues after already succeeded ordinals in the same run. A second decision cannot replay it. **拒绝并终止** marks both the node and run failed and never executes later steps.

Startup recovery excludes runs whose active node has a matching pending approval, so an application restart preserves the wait instead of misclassifying it as an interrupted query. Expiry closes the approval, node, and run. Editing the workflow definition or target before a decision cancels the old authority and fails the old run. Pending scheduled trigger delivery remains idempotent: its existing operation ID sees the waiting run, and after approval the same event observes the terminal run and performs the existing atomic conversation delivery. No scheduler, renderer timer, or previous query/Agent/MCP approval can synthesize a workflow decision.

## Persistent trigger delivery

The Go data core, not the renderer, stores trigger state and creates deduplicated trigger events with a UUID operation identity. Electron main checks for work on startup and every 30 seconds while BuBu is open. A pending event survives application restart and reuses the same operation identity, so a lost response cannot create a duplicate workflow run. Missed scheduled windows collapse into one catch-up event rather than a burst.

After the idempotent workflow reaches a terminal state, Go verifies that the run belongs to the event, derives the typed final result or bounded error, appends it to the existing local conversation, and marks the event terminal in one SQLite transaction. A crash cannot commit only half of that delivery. Electron then shows an operating-system notification containing only completion status—never rows, file names, or paths. The open conversation and workflow schedule refresh from local state on the same bounded 30-second interval, without adding a generic Electron event channel, so the result appears while the user remains in that chat. Any delivered result can be exported from its chat card as a CSV only after the user chooses a local save location. If the application stopped during an active query, startup marks that run as a visible failure; the still-pending trigger then delivers the failure instead of remaining stuck. A run stopped at a human checkpoint remains pending and resumes only after its exact approval. Arbitrary retry from an unreviewed partial query checkpoint remains unavailable.

## Periodic work center

The workspace-level **周期工作中心** is a read-and-recovery projection over the existing durable queues; it is not another scheduler. A pure product policy deduplicates the latest derived recompute per target, reviewed reconciliation replay per definition, and each saved workflow. The center groups them into **等待新文件、正在运行、需要处理、已完成、已计划**, shows the next due time or bounded failure reason, and links back to the owning data object, business topic, Reconcile Artifact, or workflow evidence.

Recovery remains authority-specific. A failed workflow reruns its exact saved definition with a fresh idempotency key; a paused Clean or Reconcile task retries its existing durable event only while the three-attempt budget allows it. Schema, quality, cardinality, control-total and stale-source reasons remain distinct. The center never accepts a replacement path, edits a plan, or invents a generic retry that could bypass the relevant review surface.

## Cancellation and failure behavior

Manual runs use the named operation cancellation path. Electron aborts the operation, authenticated RPC cancels the Go context, SQLite stops the active query, and BuBu records cancelled step/run terminal state without killing the data process. Deadline exhaustion is recorded as failure; explicit user cancellation is recorded as cancelled. Successful earlier step checkpoints remain in the audit.

## Current boundary

This release implements the complete currently exposed deterministic workflow product: reviewed query definitions, local-time daily/weekly/monthly calendars, legacy elapsed intervals, dataset-version triggers, idempotent runs, checkpoints, version-bound human approval and safe resume, cancellation, audit, in-app delivery, the periodic work center, and operating-system completion reminders. The interactive bounded aggregate Agent is also complete, with a filtered local tool registry, fixed budgets, and audited typed results. A user can save up to 24 reusable local Agent definitions containing only a name, usage description, and analysis goal. Definitions are parsed at the process boundary, DLP-checked before persistence, written to a private main-process file, and can prefill a later aggregate run. They never persist data, provider choice, approval, tool expansion, or schedule; every use still requires a fresh review of exact aggregate cells, model destination, tools, and budget.

One minimal signed HTTPS Webhook reminder is implemented only after the final version-bound human checkpoint, with its own encrypted destination, retry and evidence contract. Scheduled/background Agent steps, additional delivery channels, and MCP/RAG workflow steps remain unavailable. None can reuse the implemented human checkpoint or an earlier approval without its own data authority, recovery, documentation, and executable gates.
