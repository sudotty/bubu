# ADR-0003: Use provider-neutral AI, typed tools, and MCP at the boundary

## Status

Accepted

## Context

BuBu must support cloud and local models, current agent capabilities, tools, MCP, structured outputs, embeddings, and future provider features. Vendor APIs do not map one-to-one, and a lowest-common-denominator adapter would hide valuable features.

## Decision

Define internal provider and capability contracts. Implement native adapters where provider-specific features matter and an OpenAI-compatible adapter for compatible endpoints. Normalize typed messages, structured output, tool calls, usage, errors, and streaming while retaining provider-native metadata in an opaque extension field.

Unify internal tools and MCP-discovered tools in a policy-aware registry. BuBu remains the MCP host and enforces consent, isolation, and approval.

## Consequences

### Positive

- Business logic is not tied to one model vendor.
- Local Ollama and cloud providers share one product experience.
- New providers can be added without editing dataset or conversation modules.
- Provider-specific capability improvements remain accessible.

### Negative

- Adapters require contract fixtures and capability matrices.
- Some features must degrade explicitly when a provider does not support them.

## Alternatives considered

- Keep only the Volcengine SDK: rejected because it contradicts bring-your-own-model and offline requirements.
- Treat every API as OpenAI-compatible: rejected because official provider guidance documents feature loss and schema differences.
- Adopt a large cross-language agent framework: rejected because it would own BuBu's domain, persistence, and privacy boundaries.
