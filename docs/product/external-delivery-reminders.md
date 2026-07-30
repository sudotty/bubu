# External delivery reminders

Status: one bounded HTTPS Webhook adapter is implemented. Email, Slack, Teams, connector marketplaces, remote report publication and arbitrary custom payloads are not implemented.

## Explicit setup and approval

A destination contains a credential-free HTTPS URL and an HMAC signing secret. Saving encrypts the secret with operating-system storage and sends nothing. A separate test action sends a fixed `destination.test` payload containing no product data. The renderer can submit a replacement secret but cannot read one back.

External delivery can be bound only to an exact workflow ID and definition version whose final node is `human-approval`. Editing the workflow creates a new version and invalidates the binding. A successful query alone cannot send. Only consuming that run's one-use human approval and reaching a successful terminal run creates a delivery job.

## Minimal payload

The version-1 `workflow.completed` payload contains only success status, opaque workflow/run IDs, definition version, an Artifact kind/ID when the workflow result exposes one, and an opaque local open hint. It never contains raw rows, questions, prompts, model content, local paths, credentials or result tables. The exact JSON is signed with `x-bubu-signature-v1: sha256=<HMAC>` and carries a stable delivery ID for receiver-side deduplication.

Every send resolves DNS through the same public-address policy as remote MCP. HTTPS redirects are not followed. Each attempt has a 15-second bound. A job runs at most three times with deterministic 30-second and 120-second backoff. The immutable dedupe key prevents a run/destination pair from creating a second job. Restarted in-flight work becomes retryable; destination removal revokes queued work. Success, retry, final failure and revocation remain visible as local evidence without storing the secret or response body.

## Evidence boundary

Contract and pure-policy tests prove payload shape and retry mathematics. Desktop tests prove encryption, HMAC, dedupe, approval gating, retry exhaustion and revocation against a deterministic fetch adapter. The packaged journey saves and binds a synthetic HTTPS profile through the real UI and emits `BUBU_PACKAGED_EXTERNAL_DELIVERY_OK` without contacting an outside endpoint. Live delivery requires the user to choose and test a real destination; synthetic evidence is not represented as third-party acceptance.
