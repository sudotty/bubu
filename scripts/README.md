# Repository scripts

Root scripts are executable product contracts rather than informal utilities.

- `verify-repository.mjs` checks secrets, ignored artifacts, required product files, and manifest alignment.
- `verify-documentation.mjs` checks the README hierarchy and active/legacy routing.
- `verify-github.mjs` checks community files, least-privilege CI, and immutable action pins.
- `verify-architecture.mjs` checks process, privacy, SQL, MCP, preload, and migration boundaries.
- `smoke-*.mjs` exercise built sidecars and the packaged desktop with synthetic data.
- `benchmark-data-core.mjs` generates local reference data and enforces import, query, and memory budgets.

Prefer extending a verifier when a product or architecture rule must remain true. Fixtures must be synthetic, deterministic, bounded, and free of credentials or user data.
