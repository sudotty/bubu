# BuBu desktop

The desktop workspace packages the current product: Electron main supervises sidecars and OS integrations, preload exposes an explicit typed API, and the sandboxed React renderer presents datasets, groups, conversations, settings, approvals, and recovery controls.

## Boundaries

- `src/main.ts` owns lifecycle, packaged smoke setup, and process supervision wiring.
- `src/main/` owns trusted adapters for IPC registration, secure stores, approval sessions, audits, and sidecar clients. Business and disclosure policy stays in typed contracts or Go.
- `src/preload.ts` is the only renderer bridge. Do not add generic invoke, filesystem, Node, or sidecar escape hatches.
- `src/renderer/` is browser-only React. Parse incoming product data before it crosses into trusted execution; render MCP/model output as untrusted content.
- `src/shared/product-api.ts` is the renderer/main capability surface and must remain narrow and typed.

Desktop security changes require an Electron integration test. UI changes must preserve visible implemented/disabled/planned states, keyboard focus, bounded layouts, and exact one-use approval reviews. See [the UI/UX contract](../../docs/product/ui-ux-guidelines.md).

```bash
npm run start -w @bubu/desktop
npm test -w @bubu/desktop
npm run build -w @bubu/desktop
npm run capture:ui
```
