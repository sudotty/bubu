# ADR-0006: Keep one bounded Hub authority across private-file and PostgreSQL adapters

## Status

Amended and accepted; supersedes the Hub persistence timing in ADR-0002. SQLite remains the local data authority.

## Context

ADR-0002 selected PostgreSQL for a future concurrent enterprise Hub. The first complete collaboration slice needs a small, auditable design-partner deployment: explicit tenants, four roles, device credentials, opaque encrypted object versions, conflicts and signed audit, without making a second database fleet a desktop dependency. Some deployments also need managed backups and more than one Hub process, but there is still no evidence for horizontal write throughput, complex relational reporting or a normalized organization model.

## Decision

The V1 Hub keeps one `HubAuthority` domain implementation and two persistence adapters. Private-file persistence remains the zero-dependency default: JavaScript's server event loop serializes mutations and every accepted mutation writes a mode-`0600` atomic replacement before returning. Optional PostgreSQL persistence is selected only by `BUBU_HUB_DATABASE_URL`. It checks out one client per request and acquires a table-scoped session advisory lock before beginning a serializable transaction, so competing processes cannot take stale snapshots while queued on the singleton row. It then locks that row with `SELECT ... FOR UPDATE`, runs the same domain authority, updates one validated JSONB snapshot, and commits; any failure rolls back before the advisory lock is released. If lock release fails, the pooled client is discarded. PostgreSQL serialization failures (`40001`) and deadlocks (`40P01`) still retry the complete transaction at most three times; authority, validation and credential errors never retry.

The state contains tenant/member metadata, hashed device tokens, opaque AES-GCM ciphertext versions, idempotency outcomes and an Ed25519 signing key/audit chain. State parsing derives the public key from every stored private key and rejects a mismatched pair before accepting its signed audit chain. It never contains desktop raw rows, local paths, provider/MCP credentials or plaintext synchronized objects. The migration command validates a private-file snapshot and inserts it only when the PostgreSQL authority row is absent; it never overwrites an initialized store.

The CLI refuses a non-loopback cleartext listener. Production exposure requires its TLS mode or a trusted TLS termination boundary. Both adapters enforce V1 ceilings: 100 tenants, plus 100 members, 500 devices, 500 object versions, 500 operation outcomes and 500 signed audit events per tenant. PostgreSQL permits transactionally correct multi-process access, but the single locked row intentionally serializes writes and is not described as a horizontally scalable enterprise database.

Normalized PostgreSQL tables and partitioned authority become mandatory before higher object/member limits, relational organization policy, server-side search/reporting, horizontal write throughput, or measured snapshot size/lock latency exceeds the bounded budget. That later migration must preserve the same versioned contracts, idempotency keys, explicit conflicts and audit verification.

## Consequences

- The first Hub is deployable, persistent and testable without weakening local mode.
- End-to-end encryption keeps product content opaque to the Hub regardless of its persistence engine.
- Operations can remain one private state file, or use managed PostgreSQL backup and transaction tooling without changing product contracts.
- PostgreSQL dependency stays outside desktop/local mode and is loaded only by the optional Hub service.
- The serialized JSONB adapter is not suitable for unbounded enterprise scale; normalized and horizontally partitioned persistence remains evidence-gated.
