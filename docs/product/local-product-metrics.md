# Privacy-preserving local product metrics

BuBu records a small local NDJSON event stream to validate product journeys without collecting product content. The strict contract permits only a fixed event name plus optional target kind, outcome, duration, row count, and column count. It rejects questions, prompts, model output, credentials, paths, row/cell values, thread identifiers, and every unknown field.

Metrics never leave the local product data directory and never block a user action if recording fails. They measure transitions such as question submitted, plan ready, plan approved, result ready, recovery selected, Artifact opened, copied, exported, or pinned. They are diagnostic evidence, not an audit log; the append-only conversation and privacy ledger remain authoritative for task provenance and disclosure.

Run `npm run verify:product-metrics` to enforce the whitelist, renderer call sites, and local-only storage boundary.
