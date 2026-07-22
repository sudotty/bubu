# bubu-bi final disposition

Status: **Wails prototype retired.** The last uncommitted Wails DDL and table-management exploration is preserved in local snapshot commit `449c085` on `codex/legacy-ddl-snapshot`; it is not an active product branch and must not be merged into the Electron runtime.

## Decision

BuBu has one product runtime: the sandboxed Electron renderer, typed preload, Electron main process, Node AI runtime, and authoritative Go data core. The tracked Wails prototype has been removed. No new behavior may reintroduce it.

| Legacy surface | Decision | Current-product disposition |
| --- | --- | --- |
| Wails application, build metadata, and generated `wailsjs` bridge | Retire | Delete together in one isolated commit. |
| Direct model-authored SQL and DDL | Retire | Never migrate. Models may only propose typed plans; Go validates and executes approved deterministic operations. |
| DDL mode/configuration switches and in-memory confirmation tokens | Retire | Do not expose arbitrary schema mutation as a setting. |
| Table list, metadata, and table-panel UI | Retire | The current dataset catalog is the product surface. Any proven user need must be redesigned as a dataset/version capability, not copied from Wails. |
| Legacy file, database, LLM, and instance services | Retire | Their responsibilities already belong to data-core, AI runtime, and Electron lifecycle boundaries. |
| DDL guide and hand-authored HTML test page | Retire | Replace only with current automated behavior tests when a typed transformation capability is explicitly approved. |

## Allowed future replacement

If the product later needs controlled data transformation, it must introduce a versioned `TransformationPlan` through `packages/contracts`, visible preview and one-use approval in the desktop application, deterministic validation and transaction execution in data-core, immutable source versions, and auditable derived output. It must not accept raw SQL or DDL from the model, renderer, or a configuration flag.

## Retirement evidence

1. The active product has no dependency on Wails or generated bridge files.
2. Every legacy user need is explicitly retired above or independently implemented and behavior-tested in the current architecture.
3. `PRODUCT_MANIFEST.yaml`, current documentation, and verifiers no longer describe the Wails directory as a required migration input.
4. The removal is an isolated commit with `npm run verify` and Git history integrity checks.

The snapshot commit is recovery evidence only. It must not be pushed or treated as a release candidate. Ignored local configuration, uploads, and task records were deliberately left on disk and are not part of the product repository.
