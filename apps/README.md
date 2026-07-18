# Applications

`apps/` contains user-facing hosts. The only current application is [the Electron desktop](desktop/README.md).

Application code may compose product capabilities, but it must not become the authority for file access, database execution, raw-data disclosure, provider credentials, or model/MCP transport. Those responsibilities stay behind typed process boundaries.
