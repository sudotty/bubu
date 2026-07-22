# GitHub repository operations

GitHub is the review and distribution control plane, not a source of runtime product authority.

- `workflows/verify.yml` runs the full product contract on pull requests and `main`.
- `workflows/package-smoke.yml` builds unsigned native macOS arm64/x64 and Windows x64 installers, exercises their lifecycle with synthetic data, and receives no release credentials.
- `workflows/release.yml` accepts only an exact stable version tag backed by a GitHub-verified signed annotated tag, then waits for the `release` environment, signs native artifacts, assembles evidence, and creates or refreshes a draft Release. The workflow remains externally blocked until that environment and its credentials are actually configured.
- Dependabot vulnerability alerts stay enabled as a read-only repository setting. Scheduled version/security update pull requests are intentionally disabled, so `.github/dependabot.yml` must remain absent and dependency upgrades are reviewed manually without automatic branch creation.
- `CODEOWNERS`, pull-request templates, and issue forms keep security, privacy, release, and migration impact visible during review.

Every referenced Action is pinned to a full commit SHA and the workflows start with read-only repository permissions. Job-level write or OIDC permissions exist only where signing, attestations, or draft creation requires them. Do not add `pull_request_target` or expose release-environment secrets to untrusted contributions.

Merged pull-request branches are deleted automatically. This private repository keeps GitHub Actions' repository policy at `all`: the release path needs the Azure signing Actions, while GitHub documents that per-action allow patterns do not apply to private repositories. The local allowlist, immutable SHA requirement, and `verify:github` therefore remain the enforceable least-privilege boundary.

GitHub has reported Secret Scanning and Push Protection unavailable for this private repository. `npm run verify` therefore keeps local secret detection mandatory; do not treat the unavailable hosted capability as a substitute for repository hygiene.

`npm run verify:github` verifies the versioned workflow contract and allowlisted Action SHAs. `npm run verify:github:remote` audits the authenticated repository settings: read-only workflow defaults, enforced SHA pinning, vulnerability alerts, disabled automatic security-update branches, and active workflow files.

Configure and operate signing through [the release runbook](../docs/release/release-runbook.md). Published releases and remote tags are immutable; failures produce a new patch version rather than a moved tag or overwritten public asset.
