# Data core

The Go data core is BuBu's final authority for local files, SQLite state, privacy context, deterministic query validation/execution, workflows, and durable audit state. Electron supervises it through authenticated versioned RPC; no renderer code talks to it directly.

## Rules

- Parse every RPC and database boundary and fail closed on malformed or stale versions.
- Never execute model-authored SQL. Accept only typed plans and validate columns, relationships, limits, operations, and current dataset versions deterministically.
- Raw rows stay local unless a future explicit-row flow is visibly approved. Model context is schema, synthetic examples, or approved bounded aggregates.
- Imports, replacements, restores, workflow transitions, and audit changes must be atomic or recoverable after interruption.
- Automated workflow results must be delivered only to the explicit active conversation thread that owns the reviewed plan; target-only fallback delivery is forbidden.

```bash
go test ./...
go build -o bin/bubu-data-core ./cmd/bubu-data-core
```

Run these commands from this directory, or use `npm run test:data-core` and `npm run build:data-core` at the repository root.
