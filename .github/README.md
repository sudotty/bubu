# GitHub repository operations

GitHub is the review and distribution control plane, not a source of runtime product authority.

- `workflows/verify.yml` runs the portable fast product contract on pull requests and `main`.
- `workflows/package-smoke.yml` builds and exercises unsigned native macOS arm64/x64 and Windows x64 installers only for packaging-relevant pull requests or an explicit dispatch. It uploads only the small lifecycle report, not disposable installer binaries, and does not repeat the matrix after merge.
- `workflows/codeql.yml` scans TypeScript and Go on pull requests and `main` pushes. It has no scheduled trigger.
- `workflows/preview-release.yml` automatically publishes an unsigned GitHub prerelease for a valid `preview-v<semver>` tag. Its manual entry rejects stable or malformed tags before any native runner starts; it is a public-community distribution path, never a signed stable release.
- `workflows/release.yml` accepts only an exact stable version tag backed by a GitHub-verified signed annotated tag, then enters the repository-owned `release` environment (restricted to `v*` tags), signs native artifacts, assembles evidence, and creates or refreshes a draft Release. The workflow remains externally blocked until publisher credentials and real signing evidence are configured.
- Dependabot vulnerability alerts stay enabled as a read-only repository setting. Scheduled version/security update pull requests are intentionally disabled, so `.github/dependabot.yml` must remain absent and dependency upgrades are reviewed manually without automatic branch creation.
- `CODEOWNERS`, pull-request templates, and issue forms keep security, privacy, release, and migration impact visible during review.

Every referenced Action is pinned to a full commit SHA and the workflows start with read-only repository permissions. Job-level write or OIDC permissions exist only where signing, attestations, or draft creation requires them. Artifact attestations default to disabled when their optional environment variable is absent. Do not add `pull_request_target` or expose release-environment secrets to untrusted contributions.

Publisher credentials are configured only from a trusted workstation with `npm run release:configure-environment -- --repository=<owner/repository> --apply`. The command validates all values first, targets the `release` environment explicitly, passes values through standard input, and prints names only.

Merged pull-request branches are deleted automatically. The public repository keeps GitHub Actions' repository policy at `all` because the signed release path needs Azure signing Actions; the local allowlist, immutable SHA requirement, and `verify:github` remain the enforceable least-privilege boundary. `main` uses one simple merge gate: a pull request with the `Fast product contract` check passing and all conversations resolved. Squash is the only merge method, and administrators cannot bypass the rule.

Secret Scanning, Push Protection, and Private Vulnerability Reporting must remain enabled for this public repository. `npm run verify` retains local secret detection as an independent boundary.

`verify.yml` keeps the portable fast product contract on Ubuntu. `package-smoke.yml` separately proves native installer lifecycles on supported macOS and Windows targets; `codeql.yml` supplies event-driven static analysis; `release.yml` is the protected signed-release path.

`npm run verify:github` verifies the versioned workflow contract and allowlisted Action SHAs. `npm run verify:github:remote` audits the authenticated repository settings: default-branch protection, read-only workflow defaults, enforced SHA pinning, Secret Scanning/Push Protection, vulnerability alerts, disabled automatic security-update branches, active workflow files, and the presence—not the values—of every required release-environment secret and variable name. Missing publisher configuration remains an explicit warning and public-beta blocker rather than a false repository-code failure.

Configure and operate signing through [the release runbook](../docs/release/release-runbook.md). Published releases and remote tags are immutable; failures produce a new patch version rather than a moved tag or overwritten public asset.
