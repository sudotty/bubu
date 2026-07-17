# Privacy and model-provider boundary

Status: Schema/synthetic model context, provider configuration, encrypted credentials, transports, connection tests, visible query approvals, bounded local execution, and the disclosure/usage ledger are implemented. Aggregate and explicit-row policies remain in progress.

## Non-disclosure path

The Go data core owns model context construction. `dataset.context` accepts an opaque dataset ID and an explicit disclosure level. It never queries the raw row table.

- `schema-only` returns the current version ID plus column names, inferred types, and nullability.
- Column structure includes a local `unique` boolean so a group planner can choose a bounded lookup key without receiving distinct counts or values.
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

## Fail-closed disclosure and usage ledger

Every provider connection test, single-dataset plan, and group plan passes through one audited model gateway in Electron main. Before provider I/O, that gateway hashes the exact system-plus-user payload and asks the Go data core to create a `started` event. If validation or persistence fails, the model request is not sent.

The append-only local event records purpose, dataset/group/system target, disclosure level, provider ID/kind/name/model, endpoint origin, dataset/column/synthetic-row/relationship counts, request bytes, a conservative input-token estimate, output-token budget, SHA-256 request fingerprint, and the constant assertion `containsRawRows: false`. That assertion covers BuBu's automatic dataset disclosure; the user's question is necessarily sent verbatim, so both analysis composers warn against pasting sensitive rows or values into it. The event itself does not contain the question, system prompt, complete request, credential, provider response, model text, filenames, source paths, preview rows, or local query results. Base URL user information, path, query, and fragment are absent because only its HTTP(S) origin is retained.

After the bounded provider request, the gateway appends exactly one immutable outcome containing `succeeded`, `failed`, or `cancelled`, response byte count, provider-reported token usage when available, bounded safe error text, and finish time. Request summaries and outcomes are separate tables; no code path updates an existing disclosure row, and the outcome primary key prevents terminal history from being overwritten. A failure to create the starting audit blocks provider I/O. A failure to append the outcome discards a successful completion from the product path and leaves the visible `started` evidence for recovery. On the next data-core startup, recovery appends failure outcomes for interrupted requests. The newest 100 entries are visible under **模型设置 → 模型隐私账本**; the local database retains up to 100,000 and backup/restore validates the complete data-free event schema.

## Natural-language query approval

For one-dataset analysis, Electron main obtains the schema plus three generated examples from Go and sends exactly that envelope together with the user's question. The model must return one strict JSON query plan and cannot return SQL. The proposal is cryptographically untrusted: its dataset/version identity must equal the disclosed immutable context, and Go validates it again before execution.

The renderer shows the plan's purpose, dimensions, measures, filters, limit, and the complete context disclosure. No local query runs until the user selects **批准并在本地执行**. Execution returns at most 200 rows and does not make a second model request, so query results remain local. Persisted approval identities and aggregate/row disclosure to a model are still pending.

Group analysis applies the same rule to 2–8 ordered contexts. Member display names remain local; the model sees numbered sources. Its plan must build a connected equality-join tree and place only a non-null unique lookup key on every right side. The renderer shows the entire join tree and every disclosed context before approval. Go independently checks group membership/version order, columns, uniqueness, operations, filters, and result limits.

## Deliberately unavailable

Streaming events, aggregate/row disclosure approvals, policy classification, cost tables, and fallback routing remain required for the full conversation product. Cancellation, single/group planning, local execution approval, and data-free usage audit are enabled; the end-to-end privacy gateway remains `in-progress` until all higher disclosure levels are enforced.

## Official protocol inputs

- OpenAI API authentication and versioning: <https://platform.openai.com/docs/api-reference/backward-compatibility>
- Anthropic Messages: <https://platform.claude.com/docs/en/api/messages/create>
- Anthropic authentication: <https://platform.claude.com/docs/en/manage-claude/authentication>
- Gemini stable Interactions API: <https://ai.google.dev/api/interactions-api-v1>
- Gemini API versions: <https://ai.google.dev/gemini-api/docs/api-versions>
- Ollama OpenAI compatibility: <https://docs.ollama.com/api/openai-compatibility>
