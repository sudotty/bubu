import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mcpInspectionBudget, type McpInspectionInvocation } from "@bubu/contracts";
import { inspectMcpStdioServer } from "./client.js";

function fixtureInvocation(root: string): McpInspectionInvocation {
  return {
    connectionId: "a".repeat(32),
    command: process.execPath,
    args: [resolve(import.meta.dirname, "../../../../scripts/fixtures/mcp-inspection-server.mjs")],
    environment: { FIXTURE_SENTINEL: resolve(root, "invoked.txt") },
    workingDirectory: root,
    budget: mcpInspectionBudget,
  };
}

describe("MCP stdio inspection client", () => {
  it("negotiates and discovers bounded primitives without invoking any of them", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-client-"));
    const invocation = fixtureInvocation(root);
    const snapshot = await inspectMcpStdioServer(invocation);
    expect(snapshot).toMatchObject({
      requestedProtocolVersion: "2025-11-25",
      server: { name: "bubu-inspection-fixture", version: "1.0.0", title: "Isolated MCP fixture" },
      capabilities: { tools: true, resources: true, prompts: true },
      untrustedMetadata: true,
      limited: false,
    });
    expect(snapshot.instructions).toContain("UNTRUSTED FIXTURE INSTRUCTIONS");
    expect(snapshot.tools).toEqual([expect.objectContaining({
      name: "lookup_term",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    })]);
    expect(snapshot.resources).toEqual([expect.objectContaining({ uri: "bubu-dictionary://definitions" })]);
    expect(snapshot.prompts).toEqual([expect.objectContaining({
      name: "explain_term",
      arguments: [{ name: "term", description: "Term name", required: true }],
    })]);
    expect(existsSync(invocation.environment.FIXTURE_SENTINEL!)).toBe(false);
  });

  it("fails before launch when cancelled or timed out", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-client-"));
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(inspectMcpStdioServer(fixtureInvocation(root), cancelled.signal)).rejects.toThrow("cancelled");

    const timedOut = new AbortController();
    timedOut.abort();
    await expect(inspectMcpStdioServer(fixtureInvocation(root), undefined, timedOut.signal)).rejects.toThrow("30-second");
  });
});
