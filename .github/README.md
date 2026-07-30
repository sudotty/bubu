# GitHub repository operations

GitHub is the review and distribution control plane, not a source of runtime product authority.

- `workflows/verify.yml` runs the portable fast product contract on pull requests and `main`.
- `workflows/package-smoke.yml` builds and exercises unsigned native macOS arm64/x64 and Windows x64 installers only for packaging-relevant pull requests or an explicit dispatch. It uploads only the small lifecycle report, not disposable installer binaries, and does not repeat the matrix after merge.
- `workflows/codeql.yml` scans TypeScript and Go on pull requests and `main` pushes. It has no scheduled trigger.
- `workflows/preview-release.yml` is dispatched only from protected `main` for an existing immutable `preview-v<semver>` tag. It rejects malformed, off-main, version-mismatched, or unchecked tags before native runners start, then publishes one immutable unsigned prerelease.
- `workflows/release.yml` is dispatched only from protected `main` for an exact stable version tag backed by a GitHub-verified signed annotated tag. The `release` environment requires explicit owner approval, signs native artifacts, assembles byte-bound evidence, and creates or exactly refreshes a draft Release. Publisher credentials and real signing evidence remain external blockers.
- Dependabot vulnerability alerts stay enabled as a read-only repository setting. Scheduled version/security update pull requests are intentionally disabled, so `.github/dependabot.yml` must remain absent and dependency upgrades are reviewed manually without automatic branch creation.
- `CODEOWNERS`, pull-request templates, and issue forms keep security, privacy, release, and migration impact visible during review.

Every referenced Action is pinned to a full commit SHA and the workflows start with read-only repository permissions. GitHub permits only GitHub-owned Actions plus the two exact Azure signing Action revisions. Job-level write or OIDC permissions exist only where signing, attestations, or draft creation requires them. Artifact attestations default explicitly to disabled. Do not add `pull_request_target` or expose release-environment secrets to untrusted contributions.

Publisher credentials are configured only from a trusted workstation with `npm run release:configure-environment -- --repository=<owner/repository> --apply`. The command validates all values first, targets the `release` environment explicitly, passes values through standard input, and prints names only.

Merged pull-request branches are deleted automatically. `main` requires the fast product contract, PR-title policy, applicable native-package contract, CodeQL contract, and resolved conversations. Native packaging uses one always-present aggregate check, so irrelevant changes skip cleanly without weakening relevant changes. Squash is the only merge method, and administrators cannot bypass the rule.

Secret Scanning, Push Protection, and Private Vulnerability Reporting must remain enabled for this public repository. `npm run verify` retains local secret detection as an independent boundary.

`verify.yml` keeps the portable fast product contract on Ubuntu. `package-smoke.yml` separately proves native installer lifecycles on supported macOS and Windows targets; `codeql.yml` supplies event-driven static analysis; `release.yml` is the protected signed-release path.

`npm run verify:github` verifies the versioned workflow contract and allowlisted Action SHAs. `npm run verify:github:remote` audits the authenticated repository settings: default-branch protection, read-only workflow defaults, enforced SHA pinning, Secret Scanning/Push Protection, vulnerability alerts, disabled automatic security-update branches, active workflow files, and the presence—not the values—of every required release-environment secret and variable name. Missing publisher configuration remains an explicit warning and public-beta blocker rather than a false repository-code failure.

Configure repository governance with `npm run github:configure -- --repository=<owner/repository>` and operate signing through [the release runbook](../docs/release/release-runbook.md). Stable and preview tags are immutable; published previews and stable releases are never refreshed in place.
