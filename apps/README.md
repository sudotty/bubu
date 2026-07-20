# Applications

`apps/` contains user-facing hosts. The only current application is [the Electron desktop](desktop/README.md).

Application code may compose product capabilities, but it must not become the authority for file access, database execution, raw-data disclosure, provider credentials, or model/MCP transport. Those responsibilities stay behind typed process boundaries.

The desktop is built natively for the supported macOS and Windows targets; it is not a browser deployment or a wrapper around the historical Wails app. Distribution ownership and commands are documented in [the release runbook](../docs/release/release-runbook.md).
