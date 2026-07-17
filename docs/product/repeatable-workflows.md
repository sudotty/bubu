# Repeatable Workflows

BuBu can save an already generated and reviewed single-dataset or group query plan as a reusable local workflow. This turns a repeated spreadsheet question into a named, versioned operation without persisting model-generated SQL or broad tool authority.

## Save and run

After BuBu displays a query or join plan, select **保存当前计划** in the workflow section. Electron main verifies that every step exactly matches a plan in the local conversation before sending the strict workflow definition to the Go data core.

A manual workflow contains 1–8 ordered read-only query steps. Each step has a stable local name and 1–3 attempts. The complete run has a 1-second to 10-minute deadline; the current UI uses 60 seconds and two attempts. Unknown step kinds, arbitrary commands, SQL, duplicate step names, target drift, oversized plans, and extra JSON fields are rejected.

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

## Cancellation and failure behavior

Manual runs use the named operation cancellation path. Electron aborts the operation, authenticated RPC cancels the Go context, SQLite stops the active query, and BuBu records cancelled step/run terminal state without killing the data process. Deadline exhaustion is recorded as failure; explicit user cancellation is recorded as cancelled. Successful earlier step checkpoints remain in the audit.

## Current boundary

This release implements deterministic manual query workflows. Schedule and dataset-version triggers, reminders, crash resume from the next safe checkpoint, approval nodes for side effects, bounded model/agent steps, external tools, MCP, and RAG steps remain separate in-progress automation slices. Until those runtimes and gates exist, `workflows` stays `in-progress`; only the narrower manual-query workflow capabilities are marked implemented.
