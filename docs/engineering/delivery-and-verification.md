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

JavaScript dependency verification uses the npm registry's supported Bulk Advisory endpoint directly against every installed version recorded in `package-lock.json`. It retries bounded transport failures and fails on any low-or-higher advisory; it never falls back to npm's retired Quick Audit endpoint. Go dependency verification fails on reachable symbols, imported-package advisories, and module advisories. XLSX import uses the Go standard library rather than carrying a whole-workbook dependency, so the former `x/crypto/openpgp` module-only exception has been removed and the accepted advisory set is empty.

Go builds and performance evidence resolve the toolchain from `services/data-core/go.mod`, not from whichever older `go` binary happens to be first on the repository-root `PATH`. This keeps the compiled sidecar, vulnerability scan, CI setup, and reported benchmark toolchain on the same patched release.

## CI ownership

1. `verify.yml` proves the portable fast contract and squash-title policy; `codeql.yml` proves TypeScript and Go static analysis.
2. `package-smoke.yml` exposes one required aggregate and runs unsigned native installer lifecycles only when the changed paths affect supported targets.
3. `release.yml` runs only by explicit dispatch from protected `main` for an exact on-main, verified, annotated release tag. It is owner-approved, credentialed, signs artifacts, and creates a draft rather than publishing automatically.

Do not weaken a lower-cost gate to compensate for a missing higher-cost one. Keep these responsibilities separate so a failure identifies the broken boundary.

## Commit and handoff discipline

- Keep a commit to one reversible outcome. Stage only the files that establish that outcome.
- Before deleting a tracked surface, identify its references, preserve required historical evidence, and update runtime, manifest, docs, and verifiers in the same commit.
- Do not commit local configuration, databases, datasets, uploads, task records, build output, credentials, or secrets.
- Do not claim a hosted security or release control is healthy from a local check. Run `npm run verify:github:remote` when authenticated remote access is available and record external failures separately.
- Do not push, modify repository settings, create release secrets, or publish artifacts without the owner's explicit authorization.

## External closure

Repository code can make a release path ready, but it cannot create publisher identities, secret scanning entitlement, protected environments, certificate ownership, or clean-device evidence. Track those as explicit external blockers in the release readiness record; never represent them as implemented product capability.

Automated verification intentionally uses deterministic synthetic data and repo-owned local fixtures. It must not bill a real model account, read a user's production dataset, launch an arbitrary third-party MCP executable, or perform destructive acceptance against live data. The AI-runtime suite sends an actual bounded request over loopback TCP through the production Ollama/OpenAI-response adapter, so HTTP serialization, routing, response parsing, and usage accounting are exercised without an outside account. The real-cloud-provider check remains an explicit user action in Settings, where the selected endpoint, disclosure boundary, possible charge, and result are visible. `smoke:mcp` exercises the complete stdio lifecycle against real repo-owned child processes, including separately approved resource, prompt, and tool operations plus the packaged read-only demo. The packaged desktop smoke additionally proves separate prompt disclosure, strict model response, model-proposed schema-valid call, final execution approval, zero automatic loop, and the truthful no-network save path for an HTTPS remote MCP profile. Real remote transport behavior is proven against the official SDK and a deterministic local fixture in the AI-runtime suite; production SSRF policy never permits that fixture.

Human acceptance must therefore use a disposable non-sensitive dataset, a deliberately selected provider or local Ollama instance, and an explicitly reviewed MCP executable. Export, deletion, backup, restore, upgrade, and uninstall checks use disposable copies only. Record pass/fail evidence without committing credentials, raw rows, local paths, model responses, databases, or private MCP output.
