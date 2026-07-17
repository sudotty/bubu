# Local backup and recovery

Status: Implemented for the Go data-core workspace.

## What is protected

Open **模型设置 → 本地备份与恢复** and choose **创建本地数据备份**. The resulting `.bubu-backup` contains a consistent snapshot of the local SQLite workspace: imported rows, immutable versions, profiles, groups, relationships, validation rules, and dataset/group conversations.

Provider profiles and API credentials are not part of this artifact. Credentials remain in operating-system-backed encrypted storage and must be configured again on another device. The backup itself contains raw user data and is not encrypted by BuBu, so it must be stored only in a trusted, access-controlled location.

The renderer never sees the backup destination or source path. It receives only the base file name, creation time, raw database byte size, and dataset/group counts.

## Backup format and consistency

The data core runs SQLite `VACUUM INTO` through a bound path to produce a current, checkpoint-independent snapshot. It then creates a mode-`0600` ZIP container with exactly:

- `manifest.json`: format/product version, UTC creation time, SHA-256, database byte size, schema version, and catalog counts;
- `bubu.db`: the compressed SQLite snapshot.

Both archive entries use deterministic metadata. Creation streams and hashes the database with cancellation checks, syncs the archive, and publishes a same-directory temporary file by rename. A failed backup removes temporary artifacts and does not report success.

## Verified restore

Choose **从备份恢复**, select a `.bubu-backup`, then accept the native destructive warning. Before replacing current data, BuBu verifies:

- the archive has exactly the two expected regular files, with no traversal or duplicate entry;
- the strict manifest has a supported format, bounded size, valid timestamp, SHA-256, schema version, and nonnegative counts;
- extracted size and SHA-256 match the manifest;
- SQLite `integrity_check` and `foreign_key_check` pass;
- migrations are contiguous and supported;
- schema objects are allow-listed, physical data tables match version metadata, and no view or trigger exists;
- workflow definitions, runs, and checkpoints obey their count, deadline, payload, and foreign-key bounds;
- model disclosure ledger entries obey their data-free schema, request/usage budgets, provider/target identities, and lifecycle invariants;
- every version is ready, group/conversation bounds hold, and no source locator was persisted;
- manifest catalog counts match the restored database.

Only after all checks pass does the sidecar checkpoint and close the current database, move it to a restricted rollback file, atomically install the staged database, apply any supported forward migrations, and reopen it. An installation/open failure restores and reopens the original database. If the process is interrupted during the swap, startup uses the rollback file when the primary database is missing or invalid.

## Operational limits

- Restore accepts at most 64 GiB of uncompressed database content to bound decompression attacks. Larger managed deployments need an enterprise backup path rather than this desktop artifact.
- Restore replaces the complete local data-core workspace; it does not merge contacts or groups.
- Create a fresh backup before a planned restore when the current workspace must remain recoverable.
- Automated schedules, retention rotation, encrypted backup envelopes, provider-setting backup, and optional Hub disaster recovery remain separate capabilities.
