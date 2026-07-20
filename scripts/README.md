# Repository scripts

Root scripts are executable product contracts rather than informal utilities.

- `verify-repository.mjs` checks secrets, ignored artifacts, required product files, and manifest alignment.
- `verify-documentation.mjs` checks the README hierarchy and active/legacy routing.
- `verify-github.mjs` checks community files, least-privilege CI, and immutable action pins.
- `verify-architecture.mjs` checks process, privacy, SQL, MCP, preload, and migration boundaries.
- `verify-product-experience.mjs` checks conversation-first hierarchy, thread/workflow ownership, Artifact semantics, settings health, keyboard behavior, and compact reflow contracts.
- `set-product-version.mjs` moves every product workspace and lockfile entry to one reviewed stable SemVer value; `verify-version-contract.mjs` rejects drift.
- `smoke-*.mjs` exercise built sidecars, the packaged desktop, and native install/upgrade/backup/restore/uninstall lifecycles with synthetic data.
- `stage-release-assets.mjs`, `finalize-release-assets.mjs`, and `resolve-previous-release.mjs` enforce target names, previous-version upgrade evidence, checksums, SBOM inputs, and deterministic release manifests.
- `benchmark-data-core.mjs` generates local reference data and enforces import, query, and memory budgets.

Prefer extending a verifier when a product or architecture rule must remain true. Fixtures must be synthetic, deterministic, bounded, and free of credentials or user data.

Release scripts do not publish on their own. `.github/workflows/package-smoke.yml` owns credential-free native PR evidence; `.github/workflows/release.yml` owns protected signing and draft assembly. See [the release runbook](../docs/release/release-runbook.md).
