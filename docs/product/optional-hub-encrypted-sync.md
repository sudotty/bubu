# Optional Hub, RBAC and encrypted Sync

Status: the bounded V1 Hub, four-role RBAC, device credentials, explicit encrypted workflow-definition sync, immutable versions, conflict decisions, deletion tombstones, signed audit verification, reviewed remote workflow application and optional PostgreSQL persistence are implemented. Raw-row sync, policy distribution, unattended remote application, normalized relational storage and horizontal throughput scale remain unavailable.

## Local-first boundary

Desktop startup, import, query, Clean, Reconcile, workflows, reports, knowledge and MCP never wait for Hub. Hub configuration lives in Settings and can be absent or disconnected indefinitely. A failed request leaves a private bounded outbox; restart turns interrupted work back into replayable work. The scheduler retries only existing explicit items and never scans local data for new content.

Users explicitly select a saved workflow definition with **加入加密 Sync**. Electron main validates the versioned workflow contract, applies the same owner/editor `sync:write` permission matrix as Hub, serializes at most 256 KiB, encrypts it with AES-256-GCM and persists only ciphertext in outbox. The device token, content key and audit public key use operating-system encrypted storage and never cross back into renderer state. Raw rows, result tables, prompts, credentials and local paths have no sync object kind.

## Immutable versions and conflicts

Each object advances by exactly one immutable sync version and one idempotent operation UUID. Hub returns an explicit conflict when the submitted base is not current. Desktop never performs last-write-wins: the user chooses either **保留远端版本** (discard the local write with terminal evidence) or **基于远端重试本地版本** (create a new operation/version against the observed remote base). An accepted local object can create a new deletion tombstone; history remains immutable.

Pulling never mutates local authority. A live `workflow-definition` can be applied only after the user opens its decrypted preview and approves the exact plaintext SHA-256 and immutable remote version. Electron main decrypts and parses again, verifies the digest has not changed, and requires the referenced local target and conversation thread to match. **仅新增或确认相同版本** fails closed when a different same-ID local workflow exists; replacement requires the separate danger action **明确替换同 ID 本地工作流**. A private receipt records `created`, `identical`, or `replaced` and binds remote sequence/version/digest to the resulting local workflow version, making crash retries idempotent. Tombstones, report evidence, reconciliation definitions and knowledge metadata cannot enter this application path.

Pull stores ciphertext versions in a private inbox. A user can explicitly decrypt and inspect an allowlisted workflow definition, but V1 does not silently install or execute it. This keeps the Go data core and local conversation approval contract authoritative while still providing real cross-device encrypted object delivery and review.

## Server authority

The optional `services/hub` HTTP service owns tenants, owner/editor/viewer/auditor roles, members, devices, token hashes, server-side permission checks, immutable opaque versions, idempotency outcomes and conflicts. Owner APIs create/revoke members and devices. Revoked member devices stop authenticating immediately. Delete, revoke, conflict and accepted writes append events to an Ed25519-signed SHA-256 chain; owner/auditor clients verify every previous hash, event hash and signature.

The V1 server defaults to one atomic private-file writer. When `BUBU_HUB_DATABASE_URL` is set, the same authority runs on PostgreSQL: every request acquires a table-scoped session advisory lock before opening its serializable transaction, then uses `SELECT ... FOR UPDATE`, one validated JSONB snapshot update and rollback on failure. The lock is released before the pooled client can be reused; if release fails, that client is discarded. Serialization failures and deadlocks still retry the complete transaction at most three times as a database-failure safeguard; business and validation failures never retry. Non-loopback databases must select `sslmode=require`, `verify-ca`, or `verify-full`. `npm run migrate:postgres -w @bubu/hub` imports a private-file snapshot only when the PostgreSQL authority row does not already exist. Both adapters keep the same conservative limits, validate that each stored Ed25519 private key matches its public verification key, and never decrypt product objects. This PostgreSQL mode gives durable transactional multi-process correctness, not normalized relational storage or horizontal write throughput. KMS-backed signing remains later hardening. See ADR-0006.

## Evidence

- Strict contracts exclude dataset rows and unknown permissions/object kinds.
- Pure RBAC tests prove the four least-privilege roles.
- Hub tests prove strict persisted-state parsing, HTTP boundary parsing, dual permission enforcement, immutable version/idempotency, explicit conflict, member/device revocation, tombstones, restart persistence and signed-chain verification.
- A real temporary PostgreSQL test proves an eight-writer burst is serialized without lost writes, plus rollback, token non-persistence and non-overwriting private-file migration; CI repeats it against the runner PostgreSQL service.
- Desktop tests prove encryption-at-rest, no plaintext workflow persistence, offline outbox restart replay, pull/decrypt inspection, digest-bound create/identical/replace decisions, conflict rebase only after a decision, deletion and audit verification.
- Packaged UI saves a synthetic HTTPS device configuration without contacting a server, exposes the reviewed-application entry, and emits `BUBU_PACKAGED_HUB_SYNC_OK` plus `BUBU_PACKAGED_HUB_APPLICATION_ENTRY_OK`.

Synthetic and loopback evidence does not represent a production tenant rollout, TLS certificate operation or external customer acceptance.
