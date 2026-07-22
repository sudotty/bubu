# Cross-platform release engineering execution contract

Status: **ENGINEERING COMPLETE**. This plan converted the productized local application into a reproducible macOS and Windows release pipeline. Each stage ended in one scoped Git commit; external certificates and clean-device evidence remain explicit public-release gates rather than simulated success.

## Decisions already made

- Stable targets: macOS 13+ arm64/x64 and Windows 10 22H2/11 x64. Windows 11 arm64 is preview-only; ia32 and Linux are out of the beta contract.
- Distribution: GitHub Releases, assembled as a draft and published atomically. macOS gets DMG+ZIP; Windows gets Squirrel Setup.exe+nupkg+RELEASES.
- Versioning: one SemVer product version and an exact `vX.Y.Z` tag. Internal workspaces do not drift.
- Signing: Developer ID Application plus App Store Connect API-key notarization on macOS. Windows uses Azure Artifact Signing when identity/region eligibility exists, otherwise an OV cloud-HSM signer; unsigned and self-signed files cannot enter a public release.
- Updates: metadata may be generated and inspected, but the product stays update-disabled until signed upgrade and rollback evidence exists.
- Supply chain: immutable action SHAs, least privilege, SHA-256 manifest, component SBOM, and provenance only after final signing. The repository is now public, but GitHub attestations remain conditional on the repository setting and real workflow evidence; the release manifest must report when they are disabled.

## Eight commits and acceptance gates

| Stage | Delivered outcome | Commit |
| --- | --- | --- |
| 1 | Deliberate Artifact dock/drawer, readable result header, close/Escape/backdrop/focus behavior, and visible chat priority | `d98d36c` |
| 2 | Single-version verifier, exact tag rule, stable/preview support matrix, and release/channel decisions | `e939e27` |
| 3 | Platform-aware Go output/resource/runtime/smoke paths, including Windows `.exe` cross-build evidence | `eb48470` |
| 4 | Native app metadata and generated icon assets plus DMG, ZIP, and Squirrel makers | `9055cbf` |
| 5 | Fail-closed App Store Connect API-key notarization and Azure/cloud-HSM Windows signing configuration | `28bbe95` |
| 6 | Native install/launch/import/task/backup/restore/upgrade/uninstall policy and executable DMG evidence | `2f7e8d9` |
| 7 | Unsigned PR native matrix; protected signed tag jobs; deterministic assets, SBOMs, checksums, conditional attestations, and draft Release | `7aca25c` |
| 8 | README hierarchy, operator runbook, version command, current screenshots, full verifier, and closure review | this commit |

## Final truth condition

Engineering completion means source, tests, packaging configuration, CI, docs, and manifest agree. Public-beta completion additionally requires the owner-provided Apple and Windows signing identities and native clean-device evidence. Until those external facts exist, `signed-installers` remains planned and the readiness document remains blocked. The settled operating procedure is [the signed release runbook](../release/release-runbook.md).
