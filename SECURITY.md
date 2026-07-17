# Security policy

## Data and credentials

BuBu is local-first. Do not include credentials, raw prompts, query results, databases, uploads, generated exports, or user files in issues, logs, commits, or support bundles.

The historical repository tracked a local `config.yaml`. Any provider credential that was ever stored there must be considered exposed and revoked at the provider before reuse. The current tree removes that file from version control and the Electron product will use operating-system-backed secure storage.

## Reporting

Report a suspected vulnerability privately to the repository owner. Include the affected version, boundary, reproduction, and impact, but replace business data and secrets with synthetic values.

## Release requirements

- supported Electron security release;
- sandboxed renderer with context isolation and no Node integration;
- validated sender and typed preload commands;
- restrictive CSP, denied navigation/popups/permissions, and hardened fuses;
- dependency, credential, privacy non-disclosure, and packaged smoke gates;
- signed installers and updates before production distribution.
