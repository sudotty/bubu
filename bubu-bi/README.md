# BuBu Wails prototype — Migration source only

This directory preserves the historical `bubucel`/Wails prototype as migration evidence. It is not the current product, a supported runtime, or a place for new behavior. Its direct natural-language-to-SQL path, renderer/runtime bridge, credential handling, and UI claims do not satisfy the current BuBu privacy and architecture contracts.

Active development happens from [the repository root](../README.md):

```bash
cd ..
npm ci
npm run dev
```

The current product uses a sandboxed Electron renderer, typed preload, supervised Node AI runtime, and authoritative Go data core. It never executes model-authored SQL and does not send real rows to a remote model by default. Capability status lives in [PRODUCT_MANIFEST.yaml](../PRODUCT_MANIFEST.yaml).

## Historical scope

The prototype contains Wails/Go/React experiments for file import, SQLite-backed analysis, natural-language query concepts, reusable query components, and early table-management UX. Files may be read to understand or migrate a proven vertical slice. Do not import Wails dependencies into `apps/`, `services/`, or `packages/`.

Historical commands such as `wails dev` and `wails build` are archival only and are not part of root verification. After the last useful vertical slice is migrated and tested in the Electron product, this runtime and its generated bridge should be deleted.

Additional historical notes, including [README_NLP.md](README_NLP.md), may describe behavior that is unsafe, stale, partial, or no longer present. They must not be linked as current user documentation.
