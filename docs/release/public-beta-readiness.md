# Public beta readiness

Status: **BLOCKED ON EXTERNAL EVIDENCE**. The repository implements hardened native package and signed draft-release automation, but public beta is not complete until real publisher identities and clean-device distribution evidence exist.

## Implemented release engineering

- Electron packages use ASAR, embedded ASAR integrity validation, restricted fuses, a custom application protocol, and packaged sidecars.
- macOS signing and notarization are configured only when `BUBU_MAC_SIGN_IDENTITY`, `BUBU_APPLE_API_KEY_PATH`, `BUBU_APPLE_API_KEY_ID`, and `BUBU_APPLE_API_ISSUER` are supplied outside Git. Notarization uses a scoped App Store Connect API key rather than an Apple ID password.
- Windows signing supports the official Azure Artifact Signing path and a provider-specific cloud-HSM SignTool path. Partial signing variables fail at configuration load; self-signed and unsigned packages cannot satisfy the public-beta gate.
- Forge's maintained default Electron entitlements are used instead of adding custom privileges. No credential, API key, certificate, or signing log belongs in the repository.
- Pull requests build and exercise unsigned macOS arm64/x64 and Windows x64 installers without release credentials. The verified public-repository workflow runs on GitHub-hosted standard runners. The signed workflow independently requires an exact GitHub-verified signed annotated version tag and enters the repository-owned `release` environment, which is restricted to `v*` tags. Publisher credentials and real signing evidence remain external blockers; secrets stay environment-scoped and no release may bypass the human draft-review checklist.
- The release workflow signs/notarizes macOS applications and DMGs, signs the packaged Windows application and Squirrel bootstrapper through Azure Artifact Signing with GitHub OIDC, and verifies the installed publisher signature.
- Public `preview-v<semver>` tags automatically build and publish an unsigned GitHub prerelease for macOS arm64/x64 and Windows x64. These previews carry checksums and synthetic lifecycle evidence, but no publisher signature, notarization, SmartScreen reputation, update promise, or stable-release claim.
- Every native job records install, synthetic import/task, backup, restore, previous-stable upgrade when one exists, and uninstall evidence. The first stable release is the only allowed no-previous-artifact exception.
- Draft aggregation produces deterministic filenames, npm and Go CycloneDX SBOMs, SHA-256 checksums, a release manifest, and conditional GitHub provenance attestations. It refuses to overwrite an already published release.
- `npm run verify:release-readiness` checks configuration and capability truth. `npm run release:preflight` additionally fails closed when the signing environment is absent.
- [The release runbook](release-runbook.md) defines environment setup, the exact tag flow, review, and recovery.

## Remaining external evidence

1. Add the real Developer ID identity, App Store Connect API key, and eligible Azure Artifact Signing publisher profile as `release` environment credentials. If the repository plan supports reviewer rules, require an independent reviewer before the first public release.
2. Run the exact-tag workflow and inspect its signed draft artifacts, signatures, notarization, stapling, checksums, both SBOMs, lifecycle JSON, and actual attestation state.
3. Complete clean-device Gatekeeper/SmartScreen, install, launch, import, task, backup, upgrade, restore, rollback, and uninstall acceptance on every stable target. Hosted CI evidence does not replace this observed acceptance.
4. Design and verify signed update discovery, metadata trust, upgrade, and rollback before enabling in-app updates. Generated Squirrel/ZIP inputs are not an update claim.
5. The legacy Wails runtime and generated bridge have been retired; retain the isolated deletion evidence and do not reintroduce a second desktop runtime.

The product choices are settled: GitHub draft releases, DMG+ZIP, Squirrel, API-key notarization, Azure OIDC signing, no ia32/Linux stable target, no automatic updates, and no unsigned fallback. The remaining items are owner credentials and observed external validation, not unresolved design choices or hidden green checks. `signed-installers` remains planned in `PRODUCT_MANIFEST.yaml` until the evidence is attached to a reviewed release.
