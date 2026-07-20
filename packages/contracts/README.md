# Process contracts

`@bubu/contracts` defines versioned messages, strict schemas, discriminated unions, budgets, identifiers, and parsing functions shared across Electron, the Node AI runtime, and the Go sidecar boundary.

Contracts are security boundaries, not convenience types:

- Add a parser for every new file, IPC, RPC, provider, MCP, model, database, or network payload.
- Keep limits explicit and test malformed, oversized, stale, and drifted inputs.
- Generated or duplicated bindings must agree before a capability is marked implemented.
- Do not expose generic commands, raw SQL, credentials, or unbounded JSON through a contract.
- Bind reusable workflow definitions to the conversation thread that owns their reviewed plan and future result evidence.

```bash
npm test -w @bubu/contracts
npm run build -w @bubu/contracts
```
