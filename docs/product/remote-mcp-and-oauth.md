# Remote MCP and OAuth

Status: implemented for bounded Streamable HTTP discovery and one explicitly approved tool call. Remote resources, remote prompts, background sessions, remembered permissions, MCP Tasks, and autonomous model loops remain unavailable.

## Product journey

Saving a connection is local configuration only. It accepts a credential-free `https` Streamable HTTP endpoint and either no authorization or a public-client OAuth Authorization Code + PKCE configuration. It does not connect, discover capabilities, open a browser, or call a tool.

OAuth begins with a separate review. BuBu owns a short-lived `127.0.0.1` callback listener, generates a 256-bit state and S256 PKCE verifier, and shows the exact authorization origin, redirect and state before opening the external browser. The callback must match that listener and state. Code exchange, access token, refresh token and expiry remain in Electron main; tokens are encrypted with operating-system storage and never cross the preload bridge. Expired credentials can be refreshed when the provider supplied a refresh token, or replaced by a new explicit authorization. Local revocation deletes the encrypted tokens immediately; BuBu does not claim provider-side revocation when no revocation endpoint was configured.

Inspection is another ten-minute, one-use approval. It initializes the official MCP Streamable HTTP client and only lists bounded tools, resources and prompts. Discovery does not invoke any primitive. A tool then requires exact JSON-schema validation and a final independent review showing the connection, HTTPS destination, tool and complete arguments. Approval performs exactly one call. The result is local, escaped, untrusted, and never automatically inserted into a model, conversation, Agent or workflow.

## Network and secret boundary

Every request resolves DNS and rejects any answer that is loopback, private, link-local, carrier-grade NAT, documentation/reserved or multicast space. Redirects are handled manually, resolved again, and capped; method-changing redirects for MCP POST are rejected. OAuth token endpoints never accept redirects and have a 30-second bound. This is a deterministic fail-closed target policy, not a claim that the remote service itself is trustworthy.

Public registry state contains authorization status but no credential. The main-process store encrypts token bundles in private files, while the renderer can only request named save, authorize, refresh, revoke, inspect and call operations. Remote audit files contain endpoint origin, request fingerprints, tool/schema identifiers, input key names and byte counts, timestamps and terminal status—never tokens, argument values, response bodies or local paths. A start without an outcome is shown as interrupted after restart.

## Evidence

- Contract tests reject non-HTTPS, credential-bearing and malformed OAuth/remote invocation messages.
- Pure network-policy tests reject public-looking URLs resolving to private or reserved addresses.
- AI-runtime tests exercise the production official-SDK Streamable HTTP transport through a deterministic loopback fixture, including discovery, schema drift rejection and one exact tool call; the test-only fixture does not weaken production SSRF policy.
- Desktop tests cover encrypted token state, expiry/refresh credentials, PKCE state binding, already-cancelled callbacks, one-use approvals and append-only audit recovery.
- The packaged desktop smoke saves a synthetic HTTPS remote profile through the real settings UI and emits `BUBU_PACKAGED_REMOTE_MCP_OK`; it intentionally performs no outside network request and uses no real credential.

These tests prove repository-owned behavior. They do not prove compatibility with every provider or constitute approval to contact a live service.
