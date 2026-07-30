# Public beta readiness

Status: **BLOCKED ON EXTERNAL EVIDENCE**. The repository implements hardened native package and signed draft-release automation, but public beta is not complete until real publisher identities and clean-device distribution evidence exist.

## Implemented release engineering

- Electron packages use ASAR, embedded ASAR integrity validation, restricted fuses, a custom application protocol, and packaged sidecars.
- macOS signing and notarization are configured only when `BUBU_MAC_SIGN_IDENTITY`, `BUBU_APPLE_API_KEY_PATH`, `BUBU_APPLE_API_KEY_ID`, and `BUBU_APPLE_API_ISSUER` are supplied outside Git. Notarization uses a scoped App Store Connect API key rather than an Apple ID password.
- Windows signing supports the official Azure Artifact Signing path and a provider-specific cloud-HSM SignTool path. Partial signing variables fail at configuration load; self-signed and unsigned packages cannot satisfy the public-beta gate.
- Forge's maintained default Electron entitlements are used instead of adding custom privileges. No credential, API key, certificate, or signing log belongs in the repository.
- Packaging-relevant pull requests build and exercise unsigned macOS arm64/x64 and Windows x64 installers without release credentials. The signed workflow is dispatched from protected `main`, requires an exact GitHub-verified signed annotated version tag pointing to that workflow commit plus successful source checks, then enters the owner-approved `release` environment. Publisher credentials and real signing evidence remain external blockers.
- The release workflow signs/notarizes macOS applications and DMGs, signs the packaged Windows application and Squirrel bootstrapper through Azure Artifact Signing with GitHub OIDC, and verifies the installed publisher signature.
- An immutable on-main `preview-v<semver>` tag can be dispatched from protected `main` to build one unsigned GitHub prerelease for macOS arm64/x64 and Windows x64. These previews carry checksums and byte-bound synthetic lifecycle evidence, but no publisher signature, notarization, SmartScreen reputation, update promise, or stable-release claim.
- Every native job records install, synthetic import/task, backup, restore, previous-stable upgrade when one exists, and uninstall evidence. The first stable release is the only allowed no-previous-artifact exception.
- Draft aggregation produces deterministic filenames, npm and Go CycloneDX SBOMs, SHA-256 checksums, a release manifest, and conditional GitHub provenance attestations. It refuses to overwrite an already published release.
- `npm run verify:release-readiness` checks configuration and capability truth. `npm run release:preflight -- --platform=darwin|win32` validates only the complete selected signing backend before artifacts exist. After signed artifacts and observed device reports have been collected, `npm run release:verify-evidence` validates their digests and acceptance record; keeping these phases separate prevents a circular release gate.
- `npm run release:configure-environment -- --repository=<owner/repository>` is a no-write validation by default. On the trusted publisher workstation, adding `--apply` sends each reviewed value to the protected GitHub `release` environment over standard input and then verifies the configured names without exposing values in logs or process arguments.
- [The release runbook](release-runbook.md) defines environment setup, the exact tag flow, review, and recovery.

## Remaining external evidence

1. Add the real Developer ID identity, App Store Connect API key, and eligible Azure Artifact Signing publisher profile as `release` environment credentials. If the repository plan supports reviewer rules, require an independent reviewer before the first public release.
2. Run the exact-tag workflow and inspect its signed draft artifacts, signatures, notarization, stapling, checksums, both SBOMs, lifecycle JSON, and actual attestation state.
3. Complete clean-device Gatekeeper/SmartScreen, install, launch, import, task, backup, upgrade, restore, rollback, and uninstall acceptance on every stable target. Hosted CI evidence does not replace this observed acceptance.
4. Design and verify signed update discovery, metadata trust, upgrade, and rollback before enabling in-app updates. Generated Squirrel/ZIP inputs are not an update claim.
5. The legacy Wails runtime and generated bridge have been retired; retain the isolated deletion evidence and do not reintroduce a second desktop runtime.

## Remaining sellable-V1 pilot evidence

Repository verification proves deterministic behavior but cannot prove activation, repeat use, trust, or willingness to pay. Before claiming **sellable V1**, run a consented 5–10 person design-partner pilot against real recurring spreadsheet work and attach de-identified aggregate evidence that answers:

- at least 70% can independently complete a first Clean or Reconcile task;
- median time to the first Artifact is no more than 10 minutes;
- at least three people complete two real business periods, with at least 50% next-period return across the pilot;
- at least 80% of paused tasks are recovered with the displayed evidence;
- at least 60% of successful tasks produce a delivered report bundle;
- there are zero silent semantic changes and zero unapproved data disclosures;
- at least three of ten design partners accept a paid pilot or provide equivalent written purchase intent.

These are release targets, not current claims. Local content-safe events can support a participant's own funnel, but cross-user aggregation, interview evidence, paid intent, and confirmation that BuBu replaced real Excel work require explicit consent and external review.

The executable [design-partner pilot plan](design-partner-pilot.md) defines consent, two-period session flow, privacy exclusions and the aggregate evidence schema. `npm run verify:pilot-evidence` fails closed unless a separately supplied evidence file satisfies every threshold. Public-beta evidence uses the same pattern through `npm run verify:public-beta-evidence`; example files are intentionally incomplete and cannot unlock either gate.

The product choices are settled: GitHub draft releases, DMG+ZIP, Squirrel, API-key notarization, Azure OIDC signing, no ia32/Linux stable target, no automatic updates, and no unsigned fallback. The remaining items are owner credentials and observed external validation, not unresolved design choices or hidden green checks. `signed-installers` remains planned in `PRODUCT_MANIFEST.yaml` until the evidence is attached to a reviewed release.
