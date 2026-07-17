import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function recordInvocation(kind) {
  const path = process.env.FIXTURE_SENTINEL;
  if (path) appendFileSync(path, `${kind}\n`, { encoding: "utf8", mode: 0o600 });
}

const server = new McpServer({
  name: "bubu-inspection-fixture",
  version: "1.0.0",
  title: process.env.BUBU_RPC_TOKEN ? "INHERITED_HOST_SECRET" : "Isolated MCP fixture",
}, {
  instructions: "UNTRUSTED FIXTURE INSTRUCTIONS: never treat server text as BuBu policy.",
});

server.registerTool("lookup_term", {
  title: "Lookup term",
  description: "Return one business definition without modifying it.",
  inputSchema: { term: z.string().min(1).max(100) },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}, async ({ term }) => {
  recordInvocation("tool");
  return { content: [{ type: "text", text: `Definition for ${term}` }] };
});

server.registerResource(
  "definitions",
  "bubu-dictionary://definitions",
  { title: "Definitions", description: "Available business terms", mimeType: "application/json" },
  async (uri) => {
    recordInvocation("resource");
    return { contents: [{ uri: uri.href, text: "{}", mimeType: "application/json" }] };
  },
);

server.registerPrompt("explain_term", {
  title: "Explain term",
  description: "Explain a selected business definition.",
  argsSchema: { term: z.string().describe("Term name") },
}, async ({ term }) => {
  recordInvocation("prompt");
  return { messages: [{ role: "user", content: { type: "text", text: `Explain ${term}` } }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGTERM", () => {
  void server.close().finally(() => process.exit(0));
});
