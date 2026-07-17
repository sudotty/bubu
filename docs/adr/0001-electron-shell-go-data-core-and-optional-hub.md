# ADR-0001: Use an Electron shell with a Go data core and optional collaboration Hub

## Status

Accepted

## Context

BuBu must grow from a small local data utility into a local-first AI data workspace with model providers, MCP, bounded agents, workflows, RAG, secure updates, and optional enterprise collaboration. The current Wails application mixes files, SQLite, model calls, SQL execution, configuration, operating-system capabilities, and UI state behind a broad desktop bridge.

The installed Claude and Codex desktop applications provide local evidence that an Electron-derived multi-process runtime is a practical foundation for modern AI desktop products. Electron also supplies a consistent Chromium runtime, mature packaging and update tooling, and direct access to the Node provider and MCP ecosystem. BuBu's existing Go file and database code remains valuable and should not be rewritten merely to change the shell.

## Decision

Migrate the Wails shell to Electron and split the local application into five boundaries:

1. A sandboxed React renderer with no Node access.
2. A narrow typed preload contract containing named product commands.
3. A thin Electron main supervisor for lifecycle, permissions, credentials, updates, and process health.
4. A Node utility process for AI provider adapters, streaming, and MCP protocol translation.
5. A Go data-core sidecar for files, SQLite, import, profiling, validation, privacy enforcement, query execution, workflow state, and audit.

Main communicates with sidecars over authenticated, versioned RPC on process pipes. Sidecars do not open local TCP ports. The optional BuBu Hub is a separate server with PostgreSQL and is added only after local collaboration contracts are stable.

## Security invariants

- `nodeIntegration` is disabled, context isolation and sandboxing are enabled.
- The renderer cannot access generic IPC, subprocesses, the filesystem, credentials, providers, or sidecars.
- Every IPC command validates sender, input, authorization, and result shape.
- Navigation, new windows, permissions, and remote content are denied by default.
- Content security policy, custom protocol handling, hardened Electron fuses, code signing, and signed updates are release gates.
- Secrets use operating-system-backed secure storage and never enter tracked configuration.
- The Go data core remains the final policy authority for raw-data disclosure and SQL execution.

## Consequences

### Positive

- Matches the desktop architecture and distribution model used by leading AI assistants.
- Preserves Go strengths for streaming ingestion and local analytical execution.
- Keeps provider SDK churn and MCP concerns outside the data core.
- Makes renderer compromise, AI runtime failure, and data-core authority explicit boundaries.
- Allows full offline operation and an independently deployable PostgreSQL-backed Hub.

### Negative

- Install size and idle memory are higher than a native-webview shell.
- Electron requires frequent security upgrades and platform release testing.
- Cross-language RPC, process supervision, cancellation, upgrades, and crash recovery become first-class contracts.
- The migration temporarily carries both Wails and Electron surfaces until vertical slices move.

## Alternatives considered

- Continue the current Wails monolith: rejected because its uncontrolled boundaries already break the product's core flow.
- Refactor and retain Wails: viable for a smaller utility, but rejected for the requested AI platform because Wails v3 is pre-stable and Electron/Node better fit providers, MCP, deterministic rendering, packaging, and updates.
- Rewrite everything in Node: rejected because it discards the useful Go data plane without product benefit.
- Start with microservices: rejected because the local product does not need distributed operational cost; only the optional Hub is a server boundary.
