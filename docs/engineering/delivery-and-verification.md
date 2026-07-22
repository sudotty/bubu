# Delivery and verification contract

This is the operating contract for repository changes. Product state is complete only when the manifest, documentation, runtime behavior, tests, executable verifiers, and the relevant delivery evidence agree.

## Choose the smallest complete gate

| Change surface | Required proof before commit |
| --- | --- |
| Contracts, policy, docs, or source-only behavior | `npm run verify:fast` |
| Electron lifecycle, preload, renderer privilege, or packaging | `npm run verify:fast` and `npm run verify:desktop` |
| Import, query, privacy, workflow, backup, or audit authority | A failing behavior test first, then `npm run verify:fast` |
| Go dependency changes | `npm run verify:go-vulnerabilities` and `go test ./...` in `services/data-core` |
| Native installer or release assembly | Relevant native smoke, release readiness, and the release runbook |

`npm run verify` is the complete workstation gate: it composes the fast gate, packaged desktop smoke, and the deterministic performance budget. It is required before handoff for multi-surface work.

## CI ownership

1. `verify.yml` proves the portable fast contract on Ubuntu and packaged Electron behavior on macOS.
2. `package-smoke.yml` proves unsigned native installer lifecycles on each stable macOS and Windows target.
3. `release.yml` runs only for an exact, verified, annotated release tag or an explicit dispatch. It is protected, credentialed, signs artifacts, and creates a draft rather than publishing automatically.

Do not weaken a lower-cost gate to compensate for a missing higher-cost one. Keep these responsibilities separate so a failure identifies the broken boundary.

## Commit and handoff discipline

- Keep a commit to one reversible outcome. Stage only the files that establish that outcome.
- Before deleting a tracked surface, identify its references, preserve required historical evidence, and update runtime, manifest, docs, and verifiers in the same commit.
- Do not commit local configuration, databases, datasets, uploads, task records, build output, credentials, or secrets.
- Do not claim a hosted security or release control is healthy from a local check. Run `npm run verify:github:remote` when authenticated remote access is available and record external failures separately.
- Do not push, modify repository settings, create release secrets, or publish artifacts without the owner's explicit authorization.

## External closure

Repository code can make a release path ready, but it cannot create publisher identities, secret scanning entitlement, protected environments, certificate ownership, or clean-device evidence. Track those as explicit external blockers in the release readiness record; never represent them as implemented product capability.
