# BuBu repository contract

This repository builds a local-first AI data workspace. Product behavior and executable verification outrank historical implementation details.

## Architecture boundaries

- `apps/desktop`: Electron lifecycle, secure preload, and React renderer.
- `services/data-core`: Go authority for files, SQLite, privacy policy, SQL execution, workflows, and audit.
- `services/ai-runtime`: Node adapters for model providers, response streaming, tools, and MCP.
- `packages/contracts`: versioned process-boundary messages and generated bindings.
- `packages/product-core`: pure TypeScript product state and policy calculations.
- `services/hub`: optional server; it must never be required for local mode.

The renderer never accesses Node, generic IPC, files, credentials, providers, or sidecars directly. Electron main supervises processes but does not own business rules. The Go data core is the final authority for raw-data disclosure and database execution.

## Development rules

- Parse every file, IPC, RPC, model, database, and network payload at its boundary.
- Prefer pure domain functions and discriminated unions; keep I/O in adapters.
- Never send real dataset rows to a remote model by default.
- Never execute model-authored SQL without typed planning and deterministic validation.
- Never commit credentials, user data, databases, uploads, build output, or desktop metadata.
- Do not hide an unavailable capability. UI and docs must distinguish implemented, disabled, and planned behavior.
- Do not reintroduce Wails, generated bridges, or a second desktop runtime.

## Required commands

The root scripts are the product contract:

- `npm run test`: unit and contract tests.
- `npm run lint`: TypeScript, configuration, and architecture checks.
- `npm run build`: production desktop assets and sidecars.
- `npm run verify`: secrets, repository hygiene, tests, lint, and build.

Go packages additionally run `go test ./...`. Desktop security changes require an Electron integration test. Import, query, privacy, workflow, and sync changes require a failing behavior test before implementation.

## Completion

A capability is complete only when its product state in `PRODUCT_MANIFEST.yaml`, documentation, runtime, and verifier agree. Preserve the current branch and unrelated changes; commit or publish only when the user requests it and relevant checks pass.
