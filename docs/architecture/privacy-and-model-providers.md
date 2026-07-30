# Privacy and model-provider boundary

Status: The end-to-end privacy gateway for every currently executable model path is implemented: schema/synthetic planning, provider configuration, encrypted credentials, transports, connection tests, visible query approvals, bounded local execution, privacy-safe aggregate explanations, bounded approved-aggregate Agent runs, reusable Agent definitions, strict private mode, local DLP, explicit-row disclosure, versioned local-knowledge retrieval with cited chunk approval, and the disclosure/usage ledger. Workflow approval nodes are also implemented.

## Non-disclosure path

The Go data core owns model context construction. `dataset.context` accepts an opaque dataset ID and an explicit disclosure level. It never queries the raw row table.

- `schema-only` returns the current version ID plus column names, inferred types, and nullability.
- Column structure includes a local `unique` boolean so a group planner can choose a bounded lookup key without receiving distinct counts or values.
- `schema-synthetic` adds exactly three locally generated rows. Values come only from column type, row ordinal, and column ordinal.
- Dataset display name, source file name, source path, profiles, minima, maxima, and preview rows are absent.
- A strict TypeScript boundary rejects unknown fields, source metadata, schema-only examples, rows wider than the schema, and more than five synthetic rows.

The synthetic generator is deliberately generic. It is not sampling, masking, shuffling, perturbing, or paraphrasing real data, so it cannot accidentally preserve a customer, amount, identifier, or rare value. Custom business-aware fake formats remain planned and must retain this non-reversibility invariant.

## Strict private mode and local DLP

The privacy policy is parsed and persisted by Electron main in a mode-`0700` directory with an atomic mode-`0600` file. The renderer may select **本地私密** or **严格隐私**, but it cannot disable local DLP or introduce another disclosure level. In strict mode, a remote HTTPS provider receives `schema-only` context; a loopback provider may retain the existing non-reversible synthetic examples. Strict mode always rejects raw rows. Local-private mode keeps zero raw rows by default and exposes only the separately named, exact-cell, one-use path described below. Aggregate explanations keep their independent one-use review.

Every user-authored question, custom planning/output instruction used by that request, and bounded Agent goal is inspected locally before it is appended as a submitted model task or sent to a provider. The pure scanner blocks likely credentials, Chinese identity numbers, email addresses, phone numbers, and consistent multi-line pasted tables. Its renderer-facing result contains only bounded risk categories and labels—never the matched text. Main repeats enforcement, so bypassing the renderer cannot send the blocked content. Provider connectivity checks use fixed repository-owned text and do not consume user content.

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

The settings UI exposes editable starting presets for OpenAI's Responses API, DeepSeek's OpenAI-compatible Chat Completions endpoint, and local Ollama. A preset only fills visible profile fields; it never saves a credential, selects a provider, or sends a request. Model IDs remain editable because provider catalogs change independently of the desktop release.

Analysis and output prompt templates are separate from provider profiles. Dataset and business-topic templates express bounded planning preferences; aggregate-explanation templates adjust only the structure and emphasis of the final explanation. The selected template is parsed at the renderer storage boundary, parsed again with the request, included in the audited model payload, and bound into the one-use aggregate approval preview before model I/O. The non-overridable system instruction and strict plan/explanation parsers remain authoritative, so a custom template cannot request raw-row disclosure, SQL, new fields, invented evidence, arbitrary formulas, tools, code, network access, or execution.

## Fail-closed disclosure and usage ledger

Every provider connection test, single-dataset plan, group plan, approved aggregate explanation, and bounded aggregate Agent turn passes through one audited model gateway in Electron main. Before provider I/O, that gateway hashes the exact system-plus-user payload and asks the Go data core to create a `started` event. If validation or persistence fails, the model request is not sent.

The append-only local event records purpose, dataset/group/system target, disclosure level, provider ID/kind/name/model, endpoint origin, dataset/column/synthetic-row/aggregate-row/raw-row/relationship counts, request bytes, a conservative input-token estimate, output-token budget, SHA-256 request fingerprint, and the assertion `containsRawRows`. Every automatic dataset path must record `false` and zero raw rows. Only `explicit-row-explanation` may record `true`, `explicit-rows`, one dataset, 1–16 columns, and 1–20 rows. The event itself never stores the question, system prompt, complete request, credential, provider response, model text, filenames, source paths, preview rows, cell values, aggregate values, or local query results. Base URL user information, path, query, and fragment are absent because only its HTTP(S) origin is retained.

After the bounded provider request, the gateway appends exactly one immutable outcome containing `succeeded`, `failed`, or `cancelled`, response byte count, provider-reported token usage when available, bounded safe error text, and finish time. Request summaries and outcomes are separate tables; no code path updates an existing disclosure row, and the outcome primary key prevents terminal history from being overwritten. A failure to create the starting audit blocks provider I/O. A failure to append the outcome discards a successful completion from the product path and leaves the visible `started` evidence for recovery. On the next data-core startup, recovery appends failure outcomes for interrupted requests. The newest 100 entries are visible under **模型设置 → 模型隐私账本**; the local database retains up to 100,000 and backup/restore validates the complete data-free event schema.

## Natural-language query approval

For one-dataset analysis, Electron main obtains the schema plus three generated examples from Go and sends exactly that envelope together with the user's question. The model must return one strict JSON query plan and cannot return SQL. The proposal is cryptographically untrusted: its dataset/version identity must equal the disclosed immutable context, and Go validates it again before execution.

The renderer shows the plan's purpose, dimensions, measures, filters, limit, and the complete context disclosure. No local query runs until the user selects **批准并在本地执行**. Execution returns at most 200 rows and does not make a second model request, so query results remain local. A qualifying aggregate can enter only the separate approval flow below. Exact raw cells can enter only the independently selected and approved flow below; a query approval cannot authorize either follow-up.

Group analysis applies the same rule to 2–8 ordered contexts. Member display names remain local; the model sees numbered sources. Its plan must build a connected equality-join tree and place only a non-null unique lookup key on every right side. The renderer shows the entire join tree and every disclosed context before approval. Go independently checks group membership/version order, columns, uniqueness, operations, filters, and result limits.

## Explicit-row disclosure approval

Raw rows remain zero by default. The optional disclosure lens requires the user to select one current immutable dataset version, 1–20 exact row numbers, 1–16 exact columns, and a bounded purpose. Wildcards, duplicates, empty selections, stale versions, unknown rows or columns, cells over 4,000 bytes, and payloads over 64 KiB fail closed. Go reads only those exact cells from SQLite, preserves the requested order, and returns the canonical payload byte count and SHA-256 fingerprint; the renderer cannot construct or widen the authoritative preview.

Electron main applies the local DLP policy to the purpose and every selected string cell, resolves the active destination, and issues at most one opaque approval valid for ten minutes. The review shows the complete cell table, real cell count, destination origin, model, byte count, fingerprint prefix, and expiry. Approval consumes the token before I/O, reloads the same current cells from Go, compares bytes and fingerprint to prevent time-of-check/time-of-use drift, reruns DLP, and rejects destination changes. Strict-private mode always rejects this path, including loopback models.

The model receives no SQL, file, MCP, code, or tool capability and must return one bounded JSON explanation. Every finding cites an exact disclosed row number and column; an undisclosed reference invalidates the entire response. The audit event records the raw row and column counts plus the request fingerprint, but never the selected values. Cancellation, dismissal, expiry, version changes, DLP findings, malformed output, invented citations, and audit failure all stop without a reusable authorization. The packaged synthetic journey exercises the complete selection, preview, one-use approval, local compatible-model call, citation, and ledger boundary.

## Aggregate explanation approval

Local query results never automatically return to a model. After an executed result has been linked to its exact reviewed plan in the append-only conversation, the user may select **检查并预览发送内容**. Electron main, not the renderer, reloads that persisted pair and derives a candidate. A candidate is rejected unless the plan contains `COUNT(*)`, contains no `minimum` or `maximum` measure, every disclosed group count is an integer of at least five, identities still match the immutable dataset/group versions, the payload is at most 64 KiB, and no more than 50 rows are selected. Additional local rows are represented only by `truncated: true`.

The review shows the complete outbound question/purpose, every column and aggregate cell, selected provider/model, exact endpoint origin, expiry, and the k>=5 policy. Main holds at most 20 candidates as opaque 256-bit tokens for ten minutes. Approval consumes a token before provider I/O; dismissal revokes it. The renderer cannot attach a replacement payload, and changing the provider destination invalidates the approval.

Aggregate strings are labeled untrusted data and never instructions. This request has no tools. The model must return strict JSON with bounded summary/findings/caveats/questions and cell coordinates; coordinates outside the approved disclosure are rejected. The typed insight is rendered as text, appended locally, and each finding shows its exact `R# / column / value` evidence. The disclosure ledger records `aggregates` and the row count without storing values.

## Bounded aggregate Agent approval

The deeper Agent path starts from the same exact persisted plan/result pair and the same count, k>=5, extrema, identity, 50-row, and 64 KiB policy. The user supplies a bounded analysis goal, then reviews the exact goal, purpose, cells, destination, expiry, tool catalog, and immutable budget before a separate one-use approval. An explanation token is not present in the Agent approval store and cannot authorize this higher-cost loop.

The runtime has at most four model turns, three local tool calls, 60 seconds wall time, 2,048 output tokens per turn, and 8,192 by construction. Before every action, strict parsing filters the request to `rank`, `compare`, or `column-summary`. These pure functions can read only coordinates inside the already approved disclosure and return cell references plus deterministic arithmetic; there is no SQL, new local query, file, network, MCP, code, export, write, or renderer-defined tool. Tool output remains untrusted data on the next model turn and cannot grant authority.

Every model turn creates and finishes its own `aggregate-agent` ledger event. A successful run stores only the fixed budget, structured tool/observation trace, final cited report, and the corresponding audit IDs as a typed local `insight`; it never stores hidden chain-of-thought or provider request/response bodies. Cancellation and the global deadline propagate to the provider process. Malformed decisions, a fourth tool request, exhausted turns, invalid arithmetic coordinates, invented evidence, destination drift, or audit failure terminate visibly.

## Deliberately unavailable

Streaming events, Agent steps in scheduled workflows, richer policy classification, provider price/cost tables, fallback routing, embeddings, OCR, and workflow knowledge steps are not part of the currently executable privacy gateway. Cancellation, single/group planning, local execution approval, one-use aggregate explanations, bounded approved-aggregate Agent runs, explicit-row approvals, local knowledge chunk approvals, and value-free usage audit are implemented and fail closed. Future scheduled-Agent or richer retrieval paths must add their own enforcement before a separate Manifest capability can move from `planned`.

## Official protocol inputs

- OpenAI Responses API migration guidance: <https://developers.openai.com/api/docs/guides/migrate-to-responses>
- OpenAI model guidance: <https://developers.openai.com/api/docs/guides/latest-model>
- DeepSeek Chat Completions API: <https://api-docs.deepseek.com/api/create-chat-completion/>
- Anthropic Messages: <https://platform.claude.com/docs/en/api/messages/create>
- Anthropic authentication: <https://platform.claude.com/docs/en/manage-claude/authentication>
- Gemini stable Interactions API: <https://ai.google.dev/api/interactions-api-v1>
- Gemini API versions: <https://ai.google.dev/gemini-api/docs/api-versions>
- Ollama OpenAI compatibility: <https://docs.ollama.com/api/openai-compatibility>
