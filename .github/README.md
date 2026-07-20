# GitHub repository operations

GitHub is the review and distribution control plane, not a source of runtime product authority.

- `workflows/verify.yml` runs the full product contract on pull requests and `main`.
- `workflows/package-smoke.yml` builds unsigned native macOS arm64/x64 and Windows x64 installers, exercises their lifecycle with synthetic data, and receives no release credentials.
- `workflows/release.yml` runs only for an exact version tag or explicit rerun, waits for the protected `release` environment, signs native artifacts, assembles evidence, and creates or refreshes a draft Release.
- `dependabot.yml` proposes npm workspace, Go module, and GitHub Action updates. Electron/Forge and React families are grouped so compatibility is reviewed together; no dependency proposal bypasses the full native matrix.
- `CODEOWNERS`, pull-request templates, and issue forms keep security, privacy, release, and migration impact visible during review.

Every referenced Action is pinned to a full commit SHA and the workflows start with read-only repository permissions. Job-level write or OIDC permissions exist only where signing, attestations, or draft creation requires them. Do not add `pull_request_target` or expose release-environment secrets to untrusted contributions.

Configure and operate signing through [the release runbook](../docs/release/release-runbook.md). Published releases and remote tags are immutable; failures produce a new patch version rather than a moved tag or overwritten public asset.
