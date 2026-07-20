# Cross-platform release engineering execution contract

Status: **IN PROGRESS**. This plan converts the productized local application into a reproducible macOS and Windows release. Each stage ends in one scoped Git commit; external certificates and clean-device evidence remain explicit release gates rather than simulated success.

## Decisions already made

- Stable targets: macOS 13+ arm64/x64 and Windows 10 22H2/11 x64. Windows 11 arm64 is preview-only; ia32 and Linux are out of the beta contract.
- Distribution: GitHub Releases, assembled as a draft and published atomically. macOS gets DMG+ZIP; Windows gets Squirrel Setup.exe+nupkg+RELEASES.
- Versioning: one SemVer product version and an exact `vX.Y.Z` tag. Internal workspaces do not drift.
- Signing: Developer ID Application plus App Store Connect API-key notarization on macOS. Windows uses Azure Artifact Signing when identity/region eligibility exists, otherwise an OV cloud-HSM signer; unsigned and self-signed files cannot enter a public release.
- Updates: metadata may be generated and inspected, but the product stays update-disabled until signed upgrade and rollback evidence exists.
- Supply chain: immutable action SHAs, least privilege, SHA-256 manifest, component SBOM, and provenance only after final signing. GitHub attestations are conditional because this repository is private and their private-repository availability depends on the account plan.

## Eight commits and acceptance gates

1. **Chat artifact workspace.** Make the result inspector a deliberate dock/drawer, prevent title/chart clipping, expose close/Escape/backdrop behavior, and preserve focus. Accept with desktop typecheck, product-experience verifier, packaged smoke, and current screenshots.
2. **Version and support contract.** Add the single-version verifier, tag rule, support matrix, release/channel decisions, and executable manifest truth. Accept with `npm run version:check` and documentation verification.
3. **Native sidecars.** Make Go output, resource copy, runtime lookup, smoke, and benchmark paths platform-aware (`.exe` on Windows) with unit/contract coverage. Accept on local macOS plus Windows CI.
4. **Native installers and metadata.** Add identifiers, authorship, icons, DMG+ZIP and Squirrel makers, deterministic artifact names, and platform-only maker selection. Accept with native unsigned `make` jobs and artifact inventory checks.
5. **Signing and notarization.** Fail closed for partial credential sets, prefer App Store Connect API keys, support Windows Azure/OV backends without secrets in Git, and verify signatures/notarization after make. Accept configuration tests locally; signed evidence remains an external release gate.
6. **Lifecycle smoke.** Add install/launch/import/task/backup/upgrade/restore/uninstall evidence scripts and retention-safe reports. Accept only on native runners; no manual checklist can replace executable checks where automation is possible.
7. **GitHub release automation.** Add unsigned PR packaging smoke, protected signed tag jobs, draft release aggregation, checksums, SBOM, conditional attestations, immutable actions, least permissions, and non-cancelling release concurrency. Accept with workflow verifier and a non-publishing manual dry run.
8. **Documentation and closure.** Synchronize every relevant README, manifest capability, release runbook, legacy migration gate, and generated screenshot; run the full verifier and inspect the branch/remote. After this commit, perform one read-only overall audit and stop.

## Final truth condition

Engineering completion means source, tests, packaging configuration, CI, docs, and manifest agree. Public-beta completion additionally requires the owner-provided Apple and Windows signing identities and native clean-device evidence. Until those external facts exist, `signed-installers` remains planned and the readiness document remains blocked.
