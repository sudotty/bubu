# Chat-first business data workspace completion

Status: implementation complete; repository and packaged-product verification are the completion authority.

## Outcome

BuBu now treats imported spreadsheets as named local data objects and multi-object groups as time-aware business topics. The permanent center is the data conversation; secondary history, version, result, and workflow information opens from the top-right or a contextual right-click action.

## Delivered product decisions

1. Importing one or more Excel/CSV files opens a bounded naming dialog. The business name is editable while original filenames and immutable versions remain auditable.
2. Version history moved into a header popover and data-object context menu. Replacement continues to create a version and never overwrites the current one in place.
3. Groups persist a business description and one of five rhythms: one-off, daily, weekly, monthly, or dataset-version. A periodic topic preselects the corresponding trigger when its reviewed plan is finalized as a workflow.
4. New task, history, result, and workflow live in the conversation toolbar. History and inspectors are focus-managed overlay drawers; right-clicking the conversation exposes the same high-frequency navigation.
5. Workflow finalization says what it does. A static/dynamic node graph visualizes the trigger, authoritative local data step, delivery into the bound conversation, latest persisted status, and next update/reminder.
6. The visual system is a calm graphite, warm-white, and muted-green desktop shell grounded in the provided WeChat and Codex references. The contact column is compact, chat owns the available space, and the composer remains available at the bottom.
7. Settings uses a compact navigation rail, ordered health findings, and focused list-detail content instead of equal-weight dashboard cards.

## Executable evidence

- TypeScript contracts parse group cadence, custom rename input, and dataset version summaries.
- Go tests cover persisted rename/version history, group metadata, replacement immutability, migration, and RPC boundaries.
- Packaged Electron smoke verifies the history/result/workflow drawers, keyboard close/focus behavior, Artifact containment, business topics, settings, and the dynamic workflow node graph at 920 × 640.
- `verify:product-experience` binds the manifest, UI surfaces, packaged screenshots, and workflow graph into one drift gate.
- `npm run verify` is the final local closure command; GitHub checks remain the publication authority after push.
