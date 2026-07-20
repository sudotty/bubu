# Public beta readiness

Status: **BLOCKED**. The repository produces a hardened development package, but public beta is not complete until all external distribution evidence exists.

## Implemented release engineering

- Electron packages use ASAR, embedded ASAR integrity validation, restricted fuses, a custom application protocol, and packaged sidecars.
- macOS signing and notarization are configured only when `BUBU_MAC_SIGN_IDENTITY`, `BUBU_APPLE_ID`, `BUBU_APPLE_APP_PASSWORD`, and `BUBU_APPLE_TEAM_ID` are supplied outside Git.
- The entitlements file is minimal for Electron's JIT runtime. No credential or certificate belongs in the repository.
- `npm run verify:release-readiness` checks configuration and capability truth. `npm run release:preflight` additionally fails closed when the signing environment is absent.

## Remaining external evidence

1. Produce and inspect a signed and notarized macOS artifact on the release runner.
2. Generate and verify signed update metadata; automatic updates are not implemented or claimed today.
3. Complete clean-device install, launch, import, task, backup, upgrade, restore, and uninstall evidence on supported macOS and Windows targets.
4. Resolve every `bubu-bi` migration slice, then delete the legacy Wails runtime and generated bridge only from a clean, reviewed tree.

These are release decisions and external validation, not hidden green checks. `signed-installers` remains planned in `PRODUCT_MANIFEST.yaml` until the evidence is attached to a release.
