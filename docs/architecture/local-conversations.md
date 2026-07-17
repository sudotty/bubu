# Local conversation and artifact contract

Status: Implemented for the primary local thread attached to each dataset contact and dataset group.

Owner: Go data core persistence; Electron main orchestration; sandboxed renderer read-only presentation.

## Model

Each dataset or group has at most one primary local conversation thread. The target is a stable dataset/group identity, not a file path or mutable table. The first user question creates the thread and its local title. Entries have a monotonic ordinal and one of four strict shapes:

| Entry | Role | Typed payload |
| --- | --- | --- |
| `question` | user | bounded question text |
| `plan` | assistant | single/group proposal including the exact disclosed contexts |
| `result` | assistant | bounded single/group local query result |
| `error` | system | bounded failure message |

There is no HTML entry, arbitrary blob entry, tool-script entry, or renderer-controlled role. Entries are inserted only; no API updates or deletes an individual entry. A group deletion transaction removes its whole thread before deleting the group, while dataset deletion will need the same contract when that product operation is implemented.

## Authority boundary

The preload API exposes only `conversations.get(target)`. It has no append method. Electron main appends a question before model planning, a validated proposal after strict model parsing, a result after local Go execution, or a bounded error after failure. Direct renderer access still cannot reach authenticated sidecar RPC.

Go independently validates target existence, target/kind/role combinations, JSON object shape, a 1 MiB entry budget, a 500-entry thread limit, and monotonic insertion inside a transaction. Stored JSON is parsed again through strict TypeScript schemas before the renderer receives it.

## Local-only behavior

Conversation rows live in the same private SQLite database and are never synchronized in default local mode. Query results may contain user data, so the conversation database inherits mode `0600` and must remain outside version control. Reloading a contact/group restores questions, plan summaries, tables, errors, and deterministic local charts.

Query responses reject any individual string cell above 10,000 bytes and any complete result above 768 KiB before it can cross RPC or be persisted. The row limit remains 200. This is an execution/persistence budget, not silent truncation; an oversized result fails visibly.

## Deliberately pending

Multiple named threads per contact, pagination beyond 500 entries, user deletion/retention policy, exports, saved report artifacts, usage/cost accounting, approval identities, cryptographic audit chaining, and optional Hub synchronization remain separate capabilities. They must not broaden default disclosure.
