# Packages

Packages contain reusable code with no host ownership.

- [contracts](contracts/README.md) owns strict process-boundary schemas and parsers.
- [product-core](product-core/README.md) owns pure, host-independent product policy shared by the renderer and Electron main.

Neither package may own files, credentials, databases, providers, sidecars, OS operations, or IPC.
