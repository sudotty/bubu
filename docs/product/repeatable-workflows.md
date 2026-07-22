# Repeatable Workflows

BuBu can save an already generated and reviewed single-dataset or group query plan as a reusable local workflow. This turns a repeated spreadsheet question into a named, versioned operation without persisting model-generated SQL or broad tool authority.

## Save and run

After BuBu displays a query or join plan, open the top-right **工作流** drawer and select **收尾为工作流**. Electron main verifies that every step exactly matches a plan in the local conversation before sending the strict workflow definition to the Go data core.

A workflow contains 1–8 ordered read-only query steps. Each step has a stable local name and 1–3 attempts. The complete run has a 1-second to 10-minute deadline; the current UI uses 60 seconds and two attempts. Unknown step kinds, arbitrary commands, SQL, duplicate step names, target drift, oversized plans, and extra JSON fields are rejected.

Before saving, choose one trigger: manual only, daily, weekly, monthly, or after the target data version changes. The three calendar choices use the device's IANA timezone and a 09:00 local business-time default: daily at 09:00, weekly on Monday at 09:00, or monthly on the first at 09:00. Business-topic cadence preselects the same workflow trigger. For a group, the version signature includes every member identity and current immutable version in saved order. Older interval definitions remain compatible; new calendar definitions calculate the next real calendar occurrence rather than approximating a month as 30 elapsed days.

On each run, BuBu:

1. creates or finds the run by its UUID idempotency key;
2. loads the exact saved definition version;
3. rebinds a dataset plan to that contact's current immutable version;
4. for a group plan, keeps the saved member identities/order and rebinds only their current versions;
5. executes through the same Go safe-query compiler used by interactive analysis;
6. writes an append-only attempt checkpoint with resolved input, typed result or bounded error;
7. marks the run succeeded, failed, or cancelled.

Repeating the same run command with the same idempotency key returns the prior run instead of duplicating work. A compatible recurring-file replacement is therefore picked up automatically. A missing column, changed group membership/order, unsafe join, stale target, or other policy violation fails visibly rather than silently changing meaning.

## Local persistence and lifecycle

Definitions, runs, attempts, resolved version identities, bounded results, and errors live in the local SQLite database. Active definitions are limited to 500, each definition to eight steps, each workflow to 10,000 retained runs, and each persisted input/result to 1 MiB. The UI reads at most the latest 50 runs.

Removing a workflow soft-deletes the active definition but retains its run audit. Permanently deleting a dataset retires workflows targeting that dataset and every affected group. Deleting a group retires its workflows. Data backup and restore include definitions, runs, and checkpoints and validate their schema, references, counts, and payload bounds before installation.

## Persistent trigger delivery

The Go data core, not the renderer, stores trigger state and creates deduplicated trigger events with a UUID operation identity. Electron main checks for work on startup and every 30 seconds while BuBu is open. A pending event survives application restart and reuses the same operation identity, so a lost response cannot create a duplicate workflow run. Missed scheduled windows collapse into one catch-up event rather than a burst.

After the idempotent workflow reaches a terminal state, Go verifies that the run belongs to the event, derives the typed final result or bounded error, appends it to the existing local conversation, and marks the event terminal in one SQLite transaction. A crash cannot commit only half of that delivery. Electron then shows an operating-system notification containing only completion status—never rows, file names, or paths. The open conversation and workflow schedule refresh from local state on the same bounded 30-second interval, without adding a generic Electron event channel, so the result appears while the user remains in that chat. Any delivered result can be exported from its chat card as a CSV only after the user chooses a local save location. If the application stopped during an active query, startup marks that run as a visible failure; the still-pending trigger then delivers the failure instead of remaining stuck. Resuming a partially completed multi-step run is a later capability.

## Cancellation and failure behavior

Manual runs use the named operation cancellation path. Electron aborts the operation, authenticated RPC cancels the Go context, SQLite stops the active query, and BuBu records cancelled step/run terminal state without killing the data process. Deadline exhaustion is recorded as failure; explicit user cancellation is recorded as cancelled. Successful earlier step checkpoints remain in the audit.

## Current boundary

This release implements deterministic query workflows plus local-time daily/weekly/monthly calendars, legacy elapsed intervals, dataset-version triggers, in-app delivery, and operating-system completion reminders. The workflow drawer renders the definition statically or the latest persisted run dynamically, including conversation delivery and next-update orientation. The interactive bounded aggregate Agent supplies a reusable pure runner, filtered local tool registry, fixed budgets, and audited typed result, but it is not yet a scheduled workflow step and cannot reuse an earlier approval. Crash resume from the next safe checkpoint, approval nodes for side effects, durable model/Agent steps, external tools, MCP, and RAG steps remain separate automation slices. Until those runtimes and gates exist, `workflows`, `bounded-agents`, and `reminders` stay `in-progress`; only their narrower executable capabilities are marked implemented.
