# Local conversation and artifact contract

Status: Implemented for multiple named local threads attached to each data object and business topic.

Owner: Go data core persistence; Electron main orchestration; sandboxed renderer read-only presentation.

## Model

Each dataset or group may have multiple bounded named local conversation threads. The target is a stable dataset/group identity, not a file path or mutable table. The first user question creates the thread and its local title; users may rename, archive, restore, create and switch threads without mixing evidence. Entries have a monotonic ordinal and one of five strict shapes:

| Entry | Role | Typed payload |
| --- | --- | --- |
| `question` | user | bounded question text |
| `plan` | assistant | single/group proposal including the exact disclosed contexts |
| `result` | assistant | bounded single/group local query result plus its reviewed source plan for new entries |
| `insight` | assistant | strict cell-cited explanation, or bounded Agent report with fixed budget, local tool observations, and disclosure-ledger IDs |
| `error` | system | bounded failure message |

There is no HTML entry, arbitrary blob entry, tool-script entry, or renderer-controlled role. Entries are inserted only; no API updates or deletes an individual entry. Group deletion removes its whole thread before deleting the group. Permanent dataset deletion removes the dataset thread and every affected undersized group's thread in the same data-core transaction.

## Authority boundary

The preload API exposes only `conversations.get(target)`. It has no append method. Electron main appends a question before model planning, a validated proposal after strict model parsing, a source-linked result after local Go execution, a validated aggregate explanation or bounded Agent insight after one-use disclosure approval, or a bounded error after failure. Direct renderer access still cannot reach authenticated sidecar RPC.

Go independently validates target existence, target/kind/role combinations, JSON object shape, a 1 MiB entry budget, a 10,000-entry durable thread limit, and monotonic insertion inside a transaction. A normal thread response contains only the latest 500 entries; older entries are fetched in ascending, strictly validated pages of at most 100. Stored JSON and page cursors are parsed again through strict TypeScript schemas before the renderer receives them.

## Local-only behavior

Conversation rows live in the same private SQLite database and are never synchronized in default local mode. Query results may contain user data, so the conversation database inherits mode `0600` and must remain outside version control. Reloading a contact/group restores questions, plan summaries, tables, cell-cited aggregate explanations and Agent reports, bounded tool/audit traces, errors, and deterministic local charts.

Query responses reject any individual string cell above 10,000 bytes and any complete result above 768 KiB before it can cross RPC or be persisted. The row limit remains 200. This is an execution/persistence budget, not silent truncation; an oversized result fails visibly.

## Deliberately bounded

Result exports and professional report bundles are implemented through their own reviewed local-file boundaries rather than as arbitrary conversation blobs. Hub sync is intentionally limited to explicitly selected encrypted workflow definitions and does not synchronize conversations or raw rows. Bounded local pagination beyond the latest 500 entries is implemented; portable configuration backup is implemented as a separate credential-free settings artifact. Users can permanently delete an exact archived task after typing its title; active tasks, changed snapshots and any thread referenced by workflow evidence fail closed. An optional 30–3,650 day policy periodically removes only old archived unreferenced threads and defaults off. Durable approvals continue to live in their owning disclosure, workflow and audit authorities instead of being forged from conversation entries.
