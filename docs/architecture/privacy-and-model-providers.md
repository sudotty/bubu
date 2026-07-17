# Privacy and model-provider boundary

Status: Model context, provider configuration, encrypted credentials, transports, and connection tests are implemented. Approvals, audit, and safe query execution are still in progress.

## Non-disclosure path

The Go data core owns model context construction. `dataset.context` accepts an opaque dataset ID and an explicit disclosure level. It never queries the raw row table.

- `schema-only` returns the current version ID plus column names, inferred types, and nullability.
- `schema-synthetic` adds exactly three locally generated rows. Values come only from column type, row ordinal, and column ordinal.
- Dataset display name, source file name, source path, profiles, minima, maxima, and preview rows are absent.
- A strict TypeScript boundary rejects unknown fields, source metadata, schema-only examples, rows wider than the schema, and more than five synthetic rows.

The synthetic generator is deliberately generic. It is not sampling, masking, shuffling, perturbing, or paraphrasing real data, so it cannot accidentally preserve a customer, amount, identifier, or rare value. Custom business-aware fake formats remain planned and must retain this non-reversibility invariant.

## Provider adapter contract

The Node AI utility process implements one internal `ModelInvocation` and normalizes every provider result to one `ModelCompletion`. A provider profile contains ID, label, kind, base URL, and model; it never contains a credential. The credential exists only in the invocation crossing the authenticated main-to-utility-process boundary.

Current transports:

| Provider kind | Transport |
| --- | --- |
| OpenAI | `POST /v1/responses` |
| Anthropic | `POST /v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01` |
| Gemini | stable `POST /v1/interactions`, `x-goog-api-key` |
| OpenAI-compatible | `POST /v1/chat/completions` for broad gateway compatibility |
| Ollama | local `POST /v1/responses` |

Requests have explicit output-token limits and a 120-second deadline. Responses are streamed into a bounded 10 MiB reader before strict extraction. HTTP 408, 429, and 5xx failures are classified retryable, but the adapter does not retry implicitly. Credentials are placed only in headers and provider error bodies are not propagated.

Remote endpoints must use HTTPS. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1`; base URLs containing credentials, query strings, or fragments are rejected. This prevents a configured cloud key from silently traveling over plaintext or being embedded in logs and state.

## Credential ownership

Electron main owns the provider registry and credentials. Provider metadata is stored separately from credential ciphertext. Credential files are encrypted with Electron `safeStorage`, directories use mode `0700`, files use mode `0600`, and replacement writes use a temporary file plus atomic rename. If operating-system encryption is unavailable, BuBu fails closed and refuses to persist a credential; credential-free loopback providers remain usable.

The renderer can submit a new credential but the preload API has no credential-read operation. Registry responses contain only a provider profile and `hasCredential` boolean. Editing metadata without entering a new credential retains the existing encrypted value. Deletion removes both metadata and the encrypted credential. The selected provider is resolved only inside Electron main and sent directly across authenticated RPC to the Node utility process.

Connection testing performs one bounded minimal generation request through the same adapter used by later conversations. Only provider identity, model, and latency return to the renderer. Neither stored credentials nor provider response bodies are included in renderer-facing errors.

## Deliberately unavailable

Streaming events, cancellation, usage ledger, privacy preview/approval, prompt assembly, query planning, and fallback routing remain required before the data-chat composer is enabled. Individual provider transports are implemented; the end-to-end privacy gateway remains `in-progress` until a safe query plan and visible disclosure approval exist.

## Official protocol inputs

- OpenAI API authentication and versioning: <https://platform.openai.com/docs/api-reference/backward-compatibility>
- Anthropic Messages: <https://platform.claude.com/docs/en/api/messages/create>
- Anthropic authentication: <https://platform.claude.com/docs/en/manage-claude/authentication>
- Gemini stable Interactions API: <https://ai.google.dev/api/interactions-api-v1>
- Gemini API versions: <https://ai.google.dev/gemini-api/docs/api-versions>
- Ollama OpenAI compatibility: <https://docs.ollama.com/api/openai-compatibility>
