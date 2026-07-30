# Controlled MCP model use

BuBu can use one already-fetched local MCP prompt as model input and can ask a model to propose one call from an already-inspected local MCP tool catalog. These are two bounded, separately approved journeys in Settings > Local connectors. They do not turn MCP into autonomous Agent authority.

## Prompt to model

The user first completes the existing local `prompts/get` review. Its result remains local-only and untrusted. A second action names a purpose and opens a new disclosure review showing the exact provider/model destination, prompt name, message count, serialized byte count, SHA-256 digest, and expiry. The earlier process-launch or prompt-get approval cannot be reused.

Approval is one-use and expires after ten minutes. Electron main re-resolves the MCP connection and provider, reapplies local DLP and strict-private policy, recomputes the exact payload digest, and then performs one audited model request. Strict-private mode rejects MCP content disclosure to a remote endpoint but permits an explicitly reviewed loopback model. The model has no tool, file, network, SQL, MCP, memory, or conversation authority. Its response must be a strict versioned JSON object.

## Model-proposed tool call

The user supplies one goal and reviews no more than 20 discovered, schema-fixed tools. Tools requiring MCP Tasks are excluded. The first approval discloses only that exact goal and catalog to the selected model. Tool names, descriptions, annotations, and JSON Schema are untrusted data, never instructions.

The model may return exactly one disclosed tool name and one top-level argument object. BuBu rejects extra output, hidden tools, multiple calls, unknown fields, invalid JSON, and arguments that fail the pinned no-network JSON Schema validator. A successful suggestion still has no execution authority.

BuBu then issues a new manual tool-call proposal. The user separately reviews the exact server, tool, schema SHA-256, task state, full arguments, destination, expiry, and side-effect warning. Only this second one-use token can start a fresh MCP process and call that one tool. There is no remembered permission, automatic retry, parallel call, loop, or model-controlled continuation.

The returned MCP content is normalized under the existing byte/part budgets, displayed as local-only untrusted data, and never automatically sent back to the model, conversation, Agent, workflow, or file writer. The model disclosure ledger stores purpose, destination origin, byte/token counts, disclosure class, and prompt fingerprint without content. The MCP operation ledger independently records the executed tool request without values or result content.

## Packaged proof

The packaged application includes a small read-only demo MCP executable so the production stdio boundary can be exercised without a shell, package runner, external account, or arbitrary third-party program. `npm run smoke:mcp` proves discovery, prompt retrieval, schema verification, one tool call, and child cleanup through the real AI runtime. `npm run smoke:desktop` drives the complete two-approval renderer journey and requires `BUBU_PACKAGED_MCP_MODEL_OK`.

Remote Streamable HTTP discovery, OAuth PKCE and one separately approved remote tool call are implemented through the distinct remote connection boundary. MCP Tasks, remote resource/prompt-to-model, Agent/workflow MCP registration, sampling, elicitation, subscriptions, and remembered permissions remain unavailable.
