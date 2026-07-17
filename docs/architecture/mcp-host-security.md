# MCP host security contract

Status: Local stdio connection persistence, explicit process-launch consent, lifecycle negotiation, bounded tools/resources/prompts discovery, and one exact approved local-only resource read are implemented. MCP prompt/tool use, model/Agent/workflow registration, remote Streamable HTTP, OAuth, roots, templates, subscriptions, sampling, and elicitation are not enabled.

## Host and process boundary

BuBu is the MCP host. Each approved inspection or resource read receives one short-lived official-SDK client connection in the Node AI utility process. The renderer cannot address the utility process, create JSON-RPC messages, choose an MCP method, run a command, or invoke an arbitrary primitive. Electron main alone resolves the stored connection, owns encrypted secrets, issues one-use capabilities, writes local audit records, and routes named operations through authenticated local RPC.

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

Electron stores each start and at most one success/failure outcome as separate immutable `0600` files below `0700` directories. The audit contains connection identity, operation, URI, secret-free request fingerprint, timestamps, terminal code, part count, and byte count, but no environment value or resource content. A start without an outcome is surfaced as interrupted after restart.

## Deliberately unavailable authority

No MCP capability is registered with the aggregate Agent, model providers, conversations, or workflows. A completed resource read remains local display data and does not authorize later disclosure. The presence of a discovered tool or prompt does not authorize execution, data disclosure, file access, network access, or side effects. Every future prompt/tool/model/workflow slice must add its own typed invocation contract, policy classification, exact input/output disclosure preview, one-use approval, audit trail, timeout, result budget, and server/profile drift check.
