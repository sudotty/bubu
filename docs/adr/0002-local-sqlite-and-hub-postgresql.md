# ADR-0002: Use SQLite locally and PostgreSQL in BuBu Hub

## Status

Accepted

## Context

The desktop needs embedded transactional storage and local analytical SQL. Enterprise collaboration needs concurrent users, policy relations, audit, and server-managed synchronization. Sharing a SQLite file across devices is unsafe and does not provide an authorization boundary.

## Decision

Use one versioned SQLite database per desktop workspace. Use PostgreSQL for the optional Hub. Synchronization occurs through signed application contracts and an outbox, never by exposing or copying a live SQLite database file.

## Consequences

### Positive

- Strong local/offline behavior.
- ACID import and derived-dataset operations.
- A correct multi-user server database when Hub is enabled.

### Negative

- Repositories require contract tests across two SQL dialects.
- Synchronization and conflicts must be designed explicitly.

## Alternatives considered

- One shared SQLite file: rejected because of locking, corruption, and missing authorization boundaries.
- PostgreSQL on every desktop: rejected because it harms installation and offline simplicity.
- Document database: rejected because datasets, versions, policies, relationships, and audits are relational.
