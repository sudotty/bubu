# bubu-bi retirement inventory

Status: **WAILS RETIRED**. The tracked Wails runtime and generated bridge have been removed. The final user-owned exploration is preserved only in a local recovery snapshot; the active Electron/Node/Go product forbids Wails dependencies. [The final disposition](bubu-bi-final-disposition.md) records the retirement decision.

| Legacy slice | Current disposition | Retirement proof |
| --- | --- | --- |
| Go data and file services | Retired; current ownership is `services/data-core` | import, replacement, export, deletion, quality, backup and performance gates pass without legacy runtime |
| Model and prompt runtime | Retired; current ownership is `services/ai-runtime` and audited desktop orchestration | provider, cancellation, disclosure, agent and MCP tests pass without legacy imports |
| React and Redux renderer | Retired; current ownership is `apps/desktop/src/renderer` | packaged product journeys and screenshots pass at the minimum viewport |
| Generated Wails bridge | Removed; never copy into active packages | `npm run verify:legacy-retirement` reports zero active Wails dependency and no tracked legacy runtime |
| Wails build metadata and binary | Removed with the legacy directory | full verify green and no tracked Wails dependency |

The deletion commit is isolated and recoverable through the local snapshot branch. It does not overwrite ignored local configuration, uploads, or task records.
