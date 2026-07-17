# ADR-0004: Put a privacy gateway and typed query plan before every model-driven action

## Status

Accepted

## Context

BuBu's product promise depends on keeping raw data local by default. The current implementation sends schema text directly and accepts model-generated SQL. String matching cannot establish a safe SQL boundary, and prompts can accidentally include sensitive values.

## Decision

Every provider request passes through a pure privacy policy evaluator that creates an auditable disclosure envelope. Natural-language analysis returns a schema-validated query plan. SQL is generated or parsed locally, checked through an AST policy, and run through a read-only connection. Mutations create versioned derived datasets through separate application commands and explicit approvals.

## Consequences

### Positive

- Privacy behavior is testable and explainable.
- Prompt injection cannot raise data disclosure or tool authority.
- Analysis and mutation have separate security paths.
- Query plans can be evaluated independently of provider prose.

### Negative

- More local metadata and type inference are required.
- Some free-form SQL requests are rejected or require an advanced mode.

## Alternatives considered

- Prompt-only safety: rejected because model instructions are not an authorization boundary.
- SQL keyword filtering: rejected because comments, multiple statements, syntax variations, and nested queries defeat string checks.
- Send sampled rows by default: rejected because it violates the local-first product promise.
