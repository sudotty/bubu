# Security policy

## Supported code

Security fixes target the current Electron product on `main`. The retired Wails prototype is not a supported runtime; it remains available only through Git history and must not be restored into the repository.

## Data and credentials

Do not include credentials, raw prompts, query results, databases, uploads, generated exports, user files, or local configuration in issues, logs, commits, or support bundles. Any provider credential previously stored in a tracked or plaintext legacy configuration must be revoked before reuse. Current credentials belong in operating-system-backed secure storage.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/sudotty/bubu/security/advisories/new). Do not open a public issue for a suspected vulnerability, and never include credentials, API keys, real datasets, database files, prompts, model output, or personally identifiable information.

Include the affected commit, a minimal synthetic reproduction, impact, and any known mitigation. The maintainer will acknowledge the report, validate scope, coordinate a fix, and publish an advisory when appropriate. No response-time SLA is promised for this pre-release private project.

## Security boundaries

BuBu defaults to local processing. Remote models receive no real spreadsheet rows unless the user enters a future explicit-row disclosure flow. Local MCP servers are untrusted local code: process launch, resource reads, prompt gets, and tool calls require visible one-use approval and remain outside model/Agent/workflow authority.

Release gates require a supported Electron security release, sandboxed renderer with context isolation and no Node integration, validated sender and typed preload capabilities, restrictive CSP, denied navigation/popups/permissions, hardened Electron fuses, dependency/credential/privacy checks, packaged smoke tests, and signed installers/updates before production distribution.
