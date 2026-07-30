# Repository scripts

Root scripts are executable product contracts rather than informal utilities.

- `verify-repository.mjs` checks secrets, ignored artifacts (including local task records), required product files, and manifest alignment.
- `verify-documentation.mjs` checks the README hierarchy and active/legacy routing.
- `verify-github.mjs` checks community files, least-privilege CI, the no-automatic-branch policy, and allowlisted immutable Action pins; `verify-github-remote.mjs` checks the corresponding authenticated GitHub repository settings.
- `npm run verify:actions` runs Actionlint against every workflow.
- `npm run audit:dependencies` submits the exact installed version sets from `package-lock.json` to npm's supported Bulk Advisory endpoint, strictly parses the response, and fails on every low-or-higher advisory without falling back to the retired Quick Audit endpoint.
- `npm run verify:go-vulnerabilities` runs the pinned `govulncheck` scanner against the Go data core. It strictly accepts the official zero-vulnerability output and fails for every reachable, imported-package, or module advisory; there is no advisory allowlist.
- `verify-architecture.mjs` checks process, privacy, SQL, MCP, preload, and migration boundaries.
- `verify-product-experience.mjs` checks conversation-first hierarchy, thread/workflow ownership, Artifact semantics, settings health, keyboard behavior, and compact reflow contracts.
- `set-product-version.mjs` moves every product workspace and lockfile entry to one reviewed stable SemVer value; `verify-version-contract.mjs` rejects drift.
- `smoke-*.mjs` exercise built sidecars, the packaged desktop, and native install/upgrade/backup/restore/uninstall lifecycles with synthetic data.
- `stage-release-assets.mjs`, `finalize-release-assets.mjs`, and `resolve-previous-release.mjs` enforce target names, previous-version upgrade evidence, checksums, SBOM inputs, and deterministic release manifests.
- `validate-preview-tag.mjs` rejects stable, malformed, and non-canonical SemVer tags before an unsigned preview can consume native runners or publish a prerelease.
- `release-preflight.mjs` defines the exact macOS and Windows signing-environment requirements, including Azure OIDC subscription data and the supported DLib authentication alternatives; its tests prevent the workflow, runbook, and fail-closed gate from drifting apart.
- `npm run release:configure-environment -- --repository=<owner/repository>` validates all publisher values without contacting GitHub. An explicit `--apply` writes only to the protected `release` environment, removes release values from the GitHub CLI child environment, passes only the current value over standard input, never prints values, and name-verifies the result. Attestations additionally require `--enable-attestations` when set to `true`.
- `benchmark-data-core.mjs` generates local reference data and enforces import, query, and memory budgets.

`npm run verify:fast` is the portable source, dependency, contract, Go, and sidecar gate. `npm run verify:desktop` builds and exercises the packaged Electron desktop. `npm run verify` adds the local performance budget and is the complete workstation gate. The retired Wails prototype is preserved only in Git history and cannot be reintroduced as an active runtime.

Prefer extending a verifier when a product or architecture rule must remain true. Fixtures must be synthetic, deterministic, bounded, and free of credentials or user data.

Release scripts do not publish on their own. `.github/workflows/package-smoke.yml` owns credential-free native PR evidence; `.github/workflows/release.yml` owns protected signing and draft assembly. See [the release runbook](../docs/release/release-runbook.md).
