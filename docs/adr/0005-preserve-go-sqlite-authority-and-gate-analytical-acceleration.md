# ADR-0005: Preserve Go and SQLite authority and gate analytical acceleration

## Status

Accepted.

## Context

BuBu needs deeper spreadsheet transformation, reconciliation, lineage, reporting, and workflow capabilities. A single implementation language can look simpler, and an analytical database can look more capable than SQLite in isolation. Those choices must be evaluated against the complete local product boundary rather than language preference or benchmark marketing.

The existing Go data core owns bounded file parsing, immutable dataset versions, schema-drift handling, SQLite transactions, disclosure policy, typed-plan validation, SQL compilation, workflow recovery, backup/restore, and append-only audit. Replacing it would therefore be a security and data-migration project, not a mechanical port.

On 2026-07-24, the repository benchmark imported and profiled a 100 MiB CSV with 183,246 rows in 4,259.4 ms, executed bounded aggregate queries at 168.84 ms P95, and peaked at 34.47 MiB resident memory on the reference device. The production build, JavaScript/TypeScript tests, Go tests, lint, packaged desktop smoke, and repository verifiers also passed. There is no current performance or distribution evidence that justifies replacing this boundary.

SQLite remains a strong fit for a single-user local application: it is transactional, portable, inspectable, cross-platform, and safe to back up as one versioned application database. DuckDB is stronger for columnar scans, Parquet, wide analytical joins, and larger transformation workloads, but its native storage and concurrency model must not become a second product authority.

## Decision

1. Keep the Go data core as the final authority for local files, raw rows, SQLite state, disclosure policy, typed-plan validation, database execution, workflows, recovery, and audit.
2. Keep one versioned SQLite database per local workspace as the system of record.
3. Put new pure product policy, task selection, prompt-template policy, presentation state, and deterministic view-model calculations in TypeScript. Keep I/O in Electron, AI-runtime, and data-core adapters.
4. Continue to exchange parsed, versioned contracts across processes. A model may propose a typed plan; it may not submit executable SQL, spreadsheet macros, JavaScript, Python, shell commands, or database identifiers.
5. Do not add a general application framework merely to standardize style. Use discriminated unions, pure functions, reducers, and explicit effects first. Adopt a state-machine or effect framework only when a concrete flow has concurrency or recovery states that the existing typed lifecycle cannot express clearly.
6. Allow a future DuckDB analytical adapter only when a committed benchmark or required feature demonstrates that SQLite cannot meet a product budget. The adapter must be supervised behind the data-core boundary, consume immutable version inputs, produce bounded typed results or new immutable derived versions, and never own catalog, policy, workflow, credential, or audit state.
7. Reconsider a full Go-to-TypeScript migration only if an implementation proves behavior parity, security parity, migration/rollback safety, native packaging across supported targets, and equal or better performance and memory use. Reducing the language count alone is not sufficient evidence.

## Analytical acceleration triggers

A DuckDB adapter becomes eligible for implementation when at least one of these is true and reproduced by a checked-in fixture:

- a supported transformation or reconciliation exceeds its published latency or memory budget in SQLite;
- Parquet scan or export becomes an implemented product requirement;
- a bounded window, pivot, or wide multi-source analytical plan would otherwise require unsafe or unmaintainable SQLite code;
- the reference workload grows beyond the SQLite performance envelope established by `npm run verify:performance`.

The adapter is not eligible merely because DuckDB has a broader analytical feature set.

## Consequences

### Positive

- Preserves the strongest existing privacy and execution boundary.
- Avoids a high-risk rewrite with no demonstrated user benefit.
- Lets TypeScript own the product-facing functional core where it provides the most leverage.
- Keeps SQLite backup, restore, migrations, and local portability simple.
- Leaves a measured path to DuckDB without committing to dual-source-of-truth complexity.

### Negative

- The repository remains polyglot and must maintain versioned RPC contracts.
- Product-core extraction must be deliberate so business policy does not drift into Electron components.
- Future analytical acceleration requires adapter, packaging, migration, and parity tests rather than a direct library swap.

## Alternatives considered

- Rewrite the data core in TypeScript: rejected because it expands the privileged Node/native-module surface, discards a tested data plane, and currently has no product or performance justification.
- Replace SQLite with DuckDB everywhere: rejected because BuBu needs transactional application state, workflow recovery, audit, and multi-process supervision in addition to analytical scans.
- Run SQLite and DuckDB as peer authorities: rejected because backup, restore, version activation, and crash recovery would become a distributed consistency problem inside a desktop app.
- Move the local product to PostgreSQL: rejected because installation, lifecycle, resource use, and offline recovery would be worse for a single-user desktop workspace.
