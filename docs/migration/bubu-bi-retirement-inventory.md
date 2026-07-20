# bubu-bi retirement inventory

Status: **BLOCKED by unrelated working-tree changes**. This stage does not delete or stage the user's current `bubu-bi` work. The active Electron/Node/Go product already forbids new Wails dependencies; final deletion waits for a clean migration decision and behavior evidence.

| Legacy slice | Current disposition | Retirement proof |
| --- | --- | --- |
| Go data and file services | Replace with `services/data-core`; retain only as migration comparison | import, replacement, export, deletion, quality, backup and performance gates pass without legacy runtime |
| Model and prompt runtime | Replace with `services/ai-runtime` and audited desktop orchestration | provider, cancellation, disclosure, agent and MCP tests pass without legacy imports |
| React and Redux renderer | Replace with `apps/desktop/src/renderer`; do not port dashboard density or broad bridge access | packaged product journeys and screenshots pass at the minimum viewport |
| Generated Wails bridge | Delete with the final legacy directory; never copy into active packages | `npm run verify:legacy-retirement` reports zero active Wails dependency |
| Wails build metadata and binary | Delete after all preceding slices are accepted | clean Git diff, no required migration evidence left, full verify green |

The deletion commit must be isolated and recoverable. It must not be combined with product behavior changes or overwrite uncommitted legacy work.
