# AI runtime

The AI runtime is a supervised Node utility process. It adapts configured model providers, handles cancellation and response normalization, and performs bounded stdio MCP protocol operations after desktop approval. It does not own dataset rows, SQLite, disclosure policy, credentials at rest, or query execution.

## Authority limits

- Every request uses an authenticated versioned RPC envelope and a strict contract parser.
- Provider adapters receive only the disclosure already authorized by Go and the desktop approval flow.
- MCP discovery invokes no primitives. Resource reads, prompt gets, and tool calls re-discover the server and verify the exact URI/name, schema, task support, arguments, and budget before one invocation.
- MCP content remains local and untrusted. Binary bodies are reduced to safe metadata before reaching the renderer; no MCP result is automatically inserted into a model, Agent, or workflow.

```bash
npm test -w @bubu/ai-runtime
npm run build -w @bubu/ai-runtime
npm run smoke:mcp
```
