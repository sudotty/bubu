# Services

Services run outside the renderer and own bounded external authority.

- [data-core](data-core/README.md) is the Go authority for local files, SQLite, disclosure, typed query execution, workflows, and audits.
- [ai-runtime](ai-runtime/README.md) is the Node utility process for model providers and approved MCP protocol operations.
- [hub](hub/README.md) is an optional independently started tenant, RBAC, encrypted object version, conflict, and signed-audit authority.

The Hub is never embedded into or required by local desktop startup. A missing or offline Hub leaves local product behavior complete and retains only previously selected encrypted outbox work.

Desktop releases embed native service outputs as supervised resources. Every stable platform job must build and smoke the data core for the same operating system and architecture as Electron; a binary copied from another target does not satisfy the release contract.
