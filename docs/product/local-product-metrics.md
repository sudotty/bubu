# Privacy-preserving local product metrics

BuBu records a small local NDJSON event stream to validate product journeys without collecting product content. The strict contract permits only a fixed event name plus optional target kind, outcome, duration, row count, and column count. It rejects questions, prompts, model output, credentials, paths, row/cell values, thread identifiers, and every unknown field.

Metrics never leave the local product data directory and never block a user action if recording fails. They measure three bounded funnels:

- activation: demo opened, Clean/Reconcile previewed, approved result ready, and evidence opened;
- recurring work: approved folder, file arrival, target suggestion or review requirement, replacement approval, run start/pause/recovery/result, and next-cycle return;
- delivery: Artifact copy/export/pin and professional report-bundle export.

`next_cycle_returned` is recorded only when a user approves a new arrival while durable recurring work already exists. It is a local product-use signal, not a cross-user identity or retention cohort. Cohort reporting or telemetry upload requires a separate explicit opt-in design and is not part of V1.

These events are diagnostic evidence, not an audit log; the append-only conversation, execution evidence, file-arrival state, and privacy ledger remain authoritative for task provenance and disclosure.

Run `npm run verify:product-metrics` to enforce the whitelist, main/renderer call sites, and local-only storage boundary.
