# Product core

`@bubu/product-core` contains pure, host-independent product policy shared by the Electron main process and React renderer. It performs no I/O and owns no files, credentials, databases, providers, sidecars, or IPC.

Current responsibilities:

- editable provider starting presets;
- bounded task starters for implemented query-plan language;
- built-in analysis prompt templates and deterministic template resolution;
- deterministic summaries, risk classification, and canonical evidence input for typed data-clean plans.
- five bounded Data Clean template definitions, including multi-source append and reference coverage.

Boundary schemas remain in `@bubu/contracts`. Persistence belongs to the host that owns it; model and database execution remain outside this package.
