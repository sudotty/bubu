# MCP host security contract

Status: Local stdio connection persistence, explicit process-launch consent, lifecycle negotiation, and bounded tools/resources/prompts discovery are implemented. MCP primitive use, model/Agent/workflow registration, remote Streamable HTTP, OAuth, roots, subscriptions, sampling, and elicitation are not enabled.

## Host and process boundary

BuBu is the MCP host. One inspected server receives one isolated official-SDK client connection in the Node AI utility process. The renderer cannot address the utility process, create JSON-RPC messages, choose an MCP method, run a command, or invoke a primitive. Electron main alone resolves the stored connection, owns encrypted secrets, issues a one-use capability, and routes the named inspection operation through authenticated local RPC.

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

## Deliberately unavailable authority

No MCP capability is registered with the aggregate Agent, model providers, conversations, or workflows. The presence of a discovered tool does not authorize execution, data disclosure, file access, network access, or side effects. The next MCP slice must add its own typed invocation contract, policy classification, exact input/output disclosure preview, one-use approval, audit trail, timeout, result budget, and server/profile drift check before any primitive can be used.
