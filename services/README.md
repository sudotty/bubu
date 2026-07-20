# Services

Services run outside the renderer and own bounded external authority.

- [data-core](data-core/README.md) is the Go authority for local files, SQLite, disclosure, typed query execution, workflows, and audits.
- [ai-runtime](ai-runtime/README.md) is the Node utility process for model providers and approved MCP protocol operations.

`services/hub` is planned and intentionally absent. Local mode must remain complete without it; do not add a placeholder server or make desktop startup depend on network availability.

Desktop releases embed native service outputs as supervised resources. Every stable platform job must build and smoke the data core for the same operating system and architecture as Electron; a binary copied from another target does not satisfy the release contract.
