# Contributing to BuBu

BuBu accepts changes against the current Electron/Go/Node product. Do not add a second desktop runtime, generated bridge, or Wails dependency.

## Before changing code

1. Read [the repository contract](AGENTS.md), [the product manifest](PRODUCT_MANIFEST.yaml), and the nearest directory README.
2. Confirm whether the capability is implemented, disabled, or planned. Do not make unavailable behavior look shipped.
3. For import, query, privacy, workflow, sync, or MCP changes, add a failing behavior test first.

## Local workflow

Use Node 22.18, npm 10.9.3, and Go 1.25 as declared by the repository. Install and verify with:

```bash
npm ci
npm run verify
```

For an iterative source change, use `npm run verify:fast`; Electron packaging changes also require `npm run verify:desktop`. The [delivery and verification contract](docs/engineering/delivery-and-verification.md) maps each change surface to its required proof. Do not replace a release, remote-security, or clean-device check with a local green result.

Keep payload parsing at every process or trust boundary. The renderer must use the typed preload API; Electron main supervises processes; Go remains authoritative for database execution and raw-data disclosure.

Version changes use `npm run version:set -- --version=<x.y.z>` followed by `npm run version:check`; do not edit workspace versions independently. Distribution changes must follow [the platform contract](docs/release/platform-support.md) and [signed release runbook](docs/release/release-runbook.md).

## Pull requests

Keep changes outcome-focused, preserve unrelated work, and explain privacy, migration, compatibility, and rollback impact. Keep each commit to one reversible outcome, and do not push, alter repository settings, or publish without explicit owner authorization. UI changes should regenerate the packaged synthetic screenshots with `npm run capture:ui`. Never attach credentials, user datasets, databases, uploads, local configuration, build output, or local `.tasks/` work records.
