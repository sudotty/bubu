# GitHub repository operations

GitHub is the review and distribution control plane, not a source of runtime product authority.

- `workflows/verify.yml` runs the portable fast product contract on pull requests and `main`.
- `workflows/package-smoke.yml` builds unsigned native macOS arm64/x64 and Windows x64 installers only for packaging-relevant changes or an explicit dispatch; individual verification/documentation scripts do not spend three native runners. It receives no release credentials.
- `workflows/preview-release.yml` automatically publishes an unsigned GitHub prerelease for a valid `preview-v<semver>` tag. Its manual entry rejects stable or malformed tags before any native runner starts; it is a public-community distribution path, never a signed stable release.
- `workflows/release.yml` accepts only an exact stable version tag backed by a GitHub-verified signed annotated tag, then enters the repository-owned `release` environment (restricted to `v*` tags), signs native artifacts, assembles evidence, and creates or refreshes a draft Release. The workflow remains externally blocked until publisher credentials and real signing evidence are configured.
- Dependabot vulnerability alerts stay enabled as a read-only repository setting. Scheduled version/security update pull requests are intentionally disabled, so `.github/dependabot.yml` must remain absent and dependency upgrades are reviewed manually without automatic branch creation.
- `CODEOWNERS`, pull-request templates, and issue forms keep security, privacy, release, and migration impact visible during review.

Every referenced Action is pinned to a full commit SHA and the workflows start with read-only repository permissions. Job-level write or OIDC permissions exist only where signing, attestations, or draft creation requires them. Do not add `pull_request_target` or expose release-environment secrets to untrusted contributions.

Merged pull-request branches are deleted automatically. The public repository keeps GitHub Actions' repository policy at `all` because the signed release path needs Azure signing Actions; the local allowlist, immutable SHA requirement, and `verify:github` remain the enforceable least-privilege boundary. The default branch is protected against deletion and force-pushes, including by administrators.

Secret Scanning and Push Protection must remain enabled for this public repository. `npm run verify` retains local secret detection as an independent boundary.

`verify.yml` keeps the portable fast product contract on Ubuntu. `package-smoke.yml` separately proves native installer lifecycles on supported macOS and Windows targets; `release.yml` is the protected signed-release path.

`npm run verify:github` verifies the versioned workflow contract and allowlisted Action SHAs. `npm run verify:github:remote` audits the authenticated repository settings: default-branch protection, read-only workflow defaults, enforced SHA pinning, Secret Scanning/Push Protection, vulnerability alerts, disabled automatic security-update branches, and active workflow files.

Configure and operate signing through [the release runbook](../docs/release/release-runbook.md). Published releases and remote tags are immutable; failures produce a new patch version rather than a moved tag or overwritten public asset.
