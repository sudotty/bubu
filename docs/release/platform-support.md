# Platform and release support

BuBu uses one semantic product version across the root package, desktop application, contracts, and AI runtime. A stable release tag is exactly `v<package.json version>`; packages are not versioned or published independently.

## Supported release targets

| Target | Status | Primary artifact | Required evidence |
| --- | --- | --- | --- |
| macOS 13+ arm64 | release target | signed and notarized DMG; ZIP companion | clean install, Gatekeeper, launch, import, task, backup/restore, upgrade, uninstall |
| macOS 13+ x64 | release target | signed and notarized DMG; ZIP companion | the same native flow on an Intel runner/device |
| Windows 10 22H2 and Windows 11 x64 | release target | signed Squirrel `Setup.exe`; `.nupkg` and `RELEASES` companions | SmartScreen/signature inspection, install, launch, import, task, backup/restore, upgrade, uninstall |
| Windows 11 arm64 | preview only | unsigned CI package until the preview lane is promoted | native runner build and full packaged smoke; never attached to a stable release |

Windows ia32 is unsupported. Linux is outside the current public-beta release contract; the optional Hub does not change the local desktop support matrix.

## Product decisions

- Release through a draft GitHub Release first. It becomes public only after every required native artifact, signature, checksum, SBOM, and smoke record is present.
- Build macOS arm64 and x64 separately. This keeps the Go sidecar and Electron runtime native and makes failures attributable; a universal package is not a beta requirement.
- Use DMG as the macOS install surface and retain ZIP for future Squirrel.Mac update compatibility. Use Squirrel.Windows for the first Windows consumer installer; MSI/MSIX is a later enterprise/store channel, not a duplicate beta path.
- Pin Node, npm, Go, Electron, Forge, and action commits. Scheduled dependency updates may propose one toolchain family at a time, but promotion requires the entire native matrix.
- Keep automatic updates disabled until signed update metadata and upgrade/rollback evidence pass. Shipping update-shaped files does not make updates implemented.
- macOS CI notarization uses an App Store Connect API key. Windows direct-download signing prefers Azure Artifact Signing when the publisher is eligible; otherwise it requires a CA-issued OV certificate backed by a cloud HSM. Self-signed packages are test-only.

## Commands

```bash
npm run version:check
npm run verify
npm run make -w @bubu/desktop -- --platform=darwin --arch=arm64
npm run make -w @bubu/desktop -- --platform=darwin --arch=x64
npm run make -w @bubu/desktop -- --platform=win32 --arch=x64
```

The native `make` commands must run on matching macOS or Windows runners. The release workflow owns signing material; local commands must not require or persist credentials.
