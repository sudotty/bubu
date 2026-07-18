# MCP host security contract

Status: Local stdio connection persistence, explicit process-launch consent, lifecycle negotiation, bounded tools/resources/prompts discovery, one exact approved local-only resource read, one exact approved local-only prompt get, and one exact approved local-only tool call are implemented. Model/Agent/workflow-driven MCP use, remembered permissions, tasks, remote Streamable HTTP, OAuth, roots, templates, subscriptions, sampling, and elicitation are not enabled.

## Host and process boundary

BuBu is the MCP host. Each approved inspection, resource read, prompt get, or tool call receives one short-lived official-SDK client connection in the Node AI utility process. The renderer cannot address the utility process, create JSON-RPC messages, choose an MCP method, run a command, or invoke an arbitrary primitive. Electron main alone resolves the stored connection, owns encrypted secrets, issues one-use capabilities, writes local audit records, and routes named operations through authenticated local RPC.

The production dependency is the pinned official `@modelcontextprotocol/sdk` v1.29.0. The v2 SDK remains pre-release, so BuBu targets MCP 2025-11-25 through the supported v1 client rather than generating a private protocol implementation.

## Configuration and secrets

Each public profile contains only an opaque ID, display name, stdio transport, user-entered absolute executable path, ordered argument array, and environment key names. Each connection is an atomic `0600` private record under a `0700` directory. Environment values are one encrypted bundle using Electron operating-system storage; the renderer can submit a replacement but cannot read a saved value.

BuBu does not pass its process environment to MCP. `BUBU_*` and Electron control keys are rejected, so the local RPC credential, provider credentials, debug flags, and unrelated shell secrets never enter the server environment. The user must explicitly supply every required environment entry.

## No Shell or package installation

The connection contract requires an absolute local executable. Shells, privilege escalators, and package runners such as `npx`, `uvx`, and equivalents are rejected. Arguments remain an array and are never concatenated into a command string or passed through `shell: true`. This release expects the user or administrator to install and vet the server before configuring BuBu; it has no one-click installer.

Immediately before review and immediately after approval, Electron resolves symlinks to the canonical file, requires a regular executable, creates a private working directory, decrypts only that connection's environment, and constructs the strict invocation again. A changed symlink, executable, profile, arguments, environment, name, working directory, or budget invalidates the approval.

## Explicit launch consent

Saving a profile never starts it. Preparing an inspection performs no utility-process I/O and returns a redacted review containing the canonical executable, every ordered argument without truncation, environment key names, expiry, and fixed limits. The UI warns that local MCP code runs with the desktop user's operating-system privileges. A separate approval click consumes a 256-bit, ten-minute, one-use token before process I/O. The pending session retains only the connection ID and a SHA-256 fingerprint of the exact launch, not decrypted environment values. Dismissal revokes it without launch.

This consent is required for every inspection; there is no auto-start or background connection. A future OS sandbox can reduce local-server authority, but the current host never claims that stdio alone isolates filesystem or network access.

## Inspection-only protocol surface

The AI utility advertises no roots, sampling, elicitation, or other client capability. After initialization it requests only paginated `tools/list`, `resources/list`, and `prompts/list` when the server advertised the corresponding capability. It never calls a tool, reads a resource, gets a prompt, subscribes, or copies server instructions into a model request.

Inspection is bounded to 30 seconds, five pages and 100 items per primitive, a 16 KiB tool input-schema limit, and a 256 KiB normalized result. Cancellation propagates from the named renderer operation through Electron, authenticated RPC, the SDK request signal, and client close. The connection/process closes in `finally` after success or failure.

Server identity, instructions, titles, descriptions, annotations, schemas, URIs, and argument descriptions are untrusted. They are normalized through strict contracts and rendered only as escaped text. Tool annotations are displayed for orientation but never treated as proof that a tool is read-only, safe, idempotent, or closed-world.

## Approved local resource read

The user can choose only a resource shown by the current bounded inspection UI; there is no arbitrary URI field. Preparing the read performs no process I/O and returns a second review with the canonical executable, every argument, environment key names, exact URI, expiry, and fixed limits. A separate 256-bit, ten-minute, one-use capability is consumed before I/O. Its in-memory launch fingerprint includes decrypted values so any secret/profile/request drift fails, while the persisted audit fingerprint deliberately excludes values and includes only the public exact request.

After approval, the utility starts a fresh connection, re-lists at most five pages and 100 resources, requires an exact URI match, and calls `resources/read` once. It accepts at most 20 returned parts and 256 KiB decoded total within 30 seconds. Text crosses into the renderer only as escaped text. Canonical base64 blobs are decoded and hashed inside the utility, then only URI, MIME type, decoded size, and SHA-256 cross the boundary. Server `_meta`, stderr, frames, blob bytes, and content above budget are rejected or discarded; nothing enters a model, conversation, Agent, workflow, or file write.

Electron stores each operation start and at most one success/failure outcome as separate immutable `0600` files below `0700` directories. Resource-read audit starts contain the URI; prompt-get starts contain the prompt name, argument keys, and combined byte count; tool-call starts contain the tool name, input-schema hash, sorted top-level input keys, and canonical input byte count. All contain only a secret/value-free request fingerprint, timestamps, terminal code, part count, and byte count—never environment values, request values, or returned content. A start without an outcome is surfaced as interrupted after restart.

## Approved local prompt get

The user can choose only a prompt shown by the current bounded inspection UI. Its form is derived from the discovered declared string arguments; there is no arbitrary prompt-name or argument-key field. Preparing performs no utility I/O and returns a second review containing the canonical executable, every process argument, environment key names, exact prompt name, every exact prompt argument value, expiry, and fixed limits. The one-use approval record stores secret/value-bound and value-free SHA-256 fingerprints, but no plaintext argument or decrypted environment value. The renderer resubmits the reviewed typed request on approval so Electron can rebuild the exact invocation and reject any profile, secret, prompt, key, value, ordering, byte-count, or budget drift before I/O.

After approval, the utility starts a fresh connection, re-lists at most five pages and 100 prompts, requires the exact prompt and its current declared arguments, rejects unknown or missing required values, and calls `prompts/get` once. It accepts at most 20 messages, 256 KiB decoded content, and 384 KiB serialized result within 30 seconds. Text and embedded text cross as escaped local-only text. Image, audio, and embedded blobs are decoded and hashed inside the utility; only type, URI where applicable, MIME, size, and SHA-256 cross the boundary. Resource links remain bounded metadata. SDK objects, `_meta`, annotations, stderr, and binary bodies do not cross.

The prompt result is displayed locally as untrusted data and is never inserted into a model request, conversation, Agent, workflow, or persisted result store. Its append-only audit contains the prompt name, ordered argument keys, combined argument byte count, value-free request fingerprint, timestamps, terminal code, message count, and decoded byte count—never argument values or returned content.

## Approved local tool call

The user can choose only a tool from the current bounded inspection and enter a top-level JSON object. The UI shows the untrusted discovered schema, annotations, and task-support state, then performs local strict-schema validation and presents a second review containing the canonical executable, every process argument, environment key names, exact tool name, schema SHA-256, exact JSON values, expiry, and fixed budgets. Task-required tools are disabled; annotations never reduce the review requirement or imply that cancellation can undo a side effect.

The one-use approval binds the connection, canonical launch, decrypted environment values, tool, exact schema, task state, exact arguments, and budgets without retaining plaintext input in the pending capability. After approval, the utility starts a fresh connection, re-lists at most five pages and 100 tools, requires exact name/schema/task equality, validates the input against the discovered JSON Schema using pinned no-network validators, and calls `tools/call` exactly once within 30 seconds. There is no retry, remembered permission, parallel call, task polling, or resource-link follow.

Text and embedded text cross as escaped local-only content. Image, audio, and embedded binary become only type/URI/MIME/size/SHA-256 metadata. Structured content is canonicalized and, when an output schema exists, validated before it crosses. `_meta`, annotations, stderr, SDK objects, raw binary, and over-budget content are discarded or rejected. `isError` remains untrusted server status rather than host policy. Neither input nor result content is persisted, inserted into a conversation, disclosed to a provider, or registered as Agent/workflow authority.

## Deliberately unavailable authority

No MCP capability is registered with the aggregate Agent, model providers, conversations, or workflows. A completed resource read, prompt get, or manually approved tool call remains local display data and does not authorize later disclosure or invocation. Discovery alone never authorizes execution, data disclosure, file access, network access, or side effects. Future model/Agent/workflow registration must add a separate typed policy and disclosure contract; the current manual approval cannot be reused.
