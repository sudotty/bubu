# Signed desktop release runbook

This is the operator contract for macOS and Windows releases. It intentionally separates reproducible repository work from owner-supplied identities, protected GitHub settings, and human publication approval.

## 1. One-time GitHub configuration

The repository-owned GitHub Actions environment `release` is restricted to the `v*` release-tag pattern. If the repository plan supports reviewer protection, require at least one independent reviewer before adding publisher credentials. Do not expose release credentials to pull-request workflows or repository-level shell scripts.

`npm run verify:github:remote` treats a missing environment or missing tag restriction as a release failure. The current private-repository plan does not support secret scanning, push protection, or environment wait/reviewer rules; local secret verification and the human draft-review checklist are mandatory compensating controls. Never bypass unavailable protection by moving release secrets to repository scope.

Configure these environment secrets for both macOS native jobs:

| Secret | Value |
| --- | --- |
| `BUBU_MAC_CERTIFICATE_P12_BASE64` | Base64 Developer ID Application certificate plus private key (`.p12`) |
| `BUBU_MAC_CERTIFICATE_PASSWORD` | Password for that `.p12` |
| `BUBU_MAC_SIGN_IDENTITY` | Exact `Developer ID Application: … (TEAMID)` identity |
| `BUBU_APPLE_API_KEY_P8_BASE64` | Base64 App Store Connect API key (`.p8`) with notarization access |
| `BUBU_APPLE_API_KEY_ID` | API key ID |
| `BUBU_APPLE_API_ISSUER` | App Store Connect issuer UUID |

Generate single-line base64 values locally without placing them in a shell history file or the repository:

```bash
base64 < DeveloperID.p12 | tr -d '\n'
base64 < AuthKey_KEYID.p8 | tr -d '\n'
```

Configure these environment variables for the Windows x64 job. BuBu chooses Azure Artifact Signing with GitHub OIDC, so no long-lived Azure client secret is stored:

| Variable | Value |
| --- | --- |
| `BUBU_AZURE_CLIENT_ID` | Federated application/client ID |
| `BUBU_AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `BUBU_AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `BUBU_AZURE_SIGNING_ENDPOINT` | Regional Artifact Signing endpoint |
| `BUBU_AZURE_SIGNING_ACCOUNT` | Signing account name |
| `BUBU_AZURE_SIGNING_PROFILE` | Public-trust certificate profile name |
| `BUBU_ENABLE_ARTIFACT_ATTESTATIONS` | `true` only when private-repository attestations are enabled for the account; otherwise `false` |

Grant the federated identity only the Artifact Signing certificate-profile signer role at the narrowest resource scope. The `release` environment and tag protections are part of the credential boundary, not optional administration.

## 2. Prepare the exact product version

### Free public preview

For a zero-cost public preview, push an annotated `preview-v<semver>` tag. The public-repository workflow builds all supported native targets and publishes an unsigned prerelease automatically. It does not require publisher credentials and must never be relabeled as stable:

```bash
git tag -a preview-v0.2.0-rc.1 -m "BuBu preview v0.2.0-rc.1"
git push origin preview-v0.2.0-rc.1
```

Use [the prerelease](https://github.com/sudotty/bubu/releases) only for evaluation. macOS Gatekeeper and Windows SmartScreen warnings are expected until the signed release path has real publisher evidence.

Choose one stable SemVer value. The helper updates the root, every current workspace, internal `@bubu/contracts` dependencies, and lockfile workspace entries together:

```bash
npm run version:set -- --version=0.2.0
npm run version:check
npm run verify
git diff -- package.json package-lock.json apps/desktop/package.json packages/contracts/package.json services/ai-runtime/package.json
```

Review and commit that version change before creating a tag. The release tag must equal a stable `v<package.json version>`, must be annotated, and must have a signature that GitHub verifies. The workflow resolves `refs/tags/<tag>` exactly, rejects branches with a similar name, and confirms the verified tag points to the checked-out commit.

## 3. Create and push a protected release tag

Use a signed annotated tag from a verified maintainer identity:

```bash
git tag -s v0.2.0 -m "BuBu v0.2.0"
git push origin HEAD
git push origin v0.2.0
```

A matching tag starts `.github/workflows/release.yml`. For a controlled rerun of an existing tag:

```bash
gh workflow run release.yml --ref v0.2.0 -f tag=v0.2.0
gh run list --workflow release.yml --limit 5
```

Never move or force-push a published release tag. Fix source or configuration, create a new patch version, and preserve the failed run as evidence.

## 4. What automation must prove

The protected workflow fails closed unless all three stable targets complete:

- macOS arm64 on `macos-15` and macOS x64 on `macos-15-intel`: native Go sidecar, Electron package, Developer ID application signature, App Store Connect notarization, signed/notarized/stapled DMG, ZIP companion, and lifecycle smoke.
- Windows x64 on `windows-2025`: native Go sidecar, signed packaged executable and PE dependencies, Squirrel package, signed bootstrap installer, installed application signature, and lifecycle smoke.
- Every target installs, launches synthetic import/task/backup/restore evidence, upgrades from the latest stable release when one exists, and uninstalls. Only the first stable release may record `skipped-no-previous-artifact`; if an older stable release exists but its expected installer is missing, the job fails.
- Aggregation produces deterministic artifact names, per-target smoke JSON, npm and Go CycloneDX SBOMs, `SHA256SUMS`, a release manifest, and build-provenance attestations when the account supports them.
- The final job creates or refreshes a draft GitHub Release. It refuses to overwrite an already published release.

The unsigned `.github/workflows/package-smoke.yml` matrix runs on pull requests and `main` without any release secret. It proves reproducible native packaging and lifecycle behavior, not publisher identity.

## 5. Review the draft before publication

Do not publish until a reviewer has:

1. matched every target and filename to [the platform matrix](platform-support.md);
2. recomputed SHA-256 values and inspected both CycloneDX documents;
3. verified macOS Developer ID, Gatekeeper, notarization, and stapling on clean supported devices;
4. verified Windows Authenticode publisher identity, SmartScreen behavior, install/uninstall, and application signature on clean Windows 10 22H2 and Windows 11 devices;
5. checked upgrade, backup, restore, and rollback evidence against the previous stable version;
6. confirmed the release manifest reports the real attestation state and every automated smoke report passed;
7. confirmed `PRODUCT_MANIFEST.yaml` and release notes do not claim updates, sync, Hub, or other planned behavior.

CI runner success is necessary but does not replace physical/VM clean-device acceptance or publisher-account review.

## 6. Failure and recovery

- **Tag/version mismatch:** delete an unpublished local tag, correct the version commit, and create the right tag. Do not move a remotely consumed tag.
- **macOS identity/key failure:** rotate the affected secret, verify the exact Developer ID identity and API-key issuer, then rerun the same protected tag only if no asset was published.
- **Notarization rejection:** download the notary log from the run, correct the application, and release a new patch version; never bypass notarization.
- **Azure/OIDC failure:** inspect environment protection, federated subject, tenant/subscription values, endpoint region, and signer role. Do not replace public signing with self-signed output.
- **Native lifecycle failure:** keep the draft private, preserve reports, fix the platform-specific defect, and release a new patch version.
- **Attestation unavailable:** set `BUBU_ENABLE_ARTIFACT_ATTESTATIONS=false`, make that absence explicit in the release manifest, and retain checksums/SBOMs. Do not claim provenance attestations that were skipped.
- **Partially assembled draft:** rerunning the same unpublished tag may refresh draft assets with `--clobber`; a published release is immutable and requires a new patch version.

Automatic in-app updates remain disabled. Squirrel files and the macOS ZIP are distribution inputs, not evidence that signed update discovery, rollback, and trust policy are implemented.
