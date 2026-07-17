import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mcpInspectionBudget,
  mcpResourceReadBudget,
  type McpInspectionInvocation,
  type McpResourceReadInvocation,
} from "@bubu/contracts";
import { inspectMcpStdioServer, readMcpStdioResource } from "./client.js";

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

function resourceInvocation(root: string, resourceUri = "bubu-dictionary://definitions"): McpResourceReadInvocation {
  const inspected = fixtureInvocation(root);
  return {
    connectionId: inspected.connectionId,
    command: inspected.command,
    args: inspected.args,
    environment: inspected.environment,
    workingDirectory: inspected.workingDirectory,
    resourceUri,
    budget: mcpResourceReadBudget,
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

  it("re-discovers and reads exactly one approved resource without exposing blob bytes", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-resource-"));
    const invocation = resourceInvocation(root);
    const result = await readMcpStdioResource(invocation);
    expect(result).toMatchObject({
      connectionId: invocation.connectionId,
      requestedUri: invocation.resourceUri,
      decodedBytes: 51,
      localOnly: true,
      untrustedContent: true,
    });
    expect(result.contents).toEqual([
      {
        kind: "text",
        uri: invocation.resourceUri,
        mimeType: "application/json",
        text: "{\"gross_margin\":\"Revenue minus cost\"}",
        decodedBytes: 37,
      },
      {
        kind: "blob",
        uri: "bubu-dictionary://icon",
        mimeType: "application/octet-stream",
        decodedBytes: 14,
        sha256: "a6c12f479dd1b4cc225f316ec635cdda0abcb8bbdd7b115acd4b43b6771235e2",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("YmluYXJ5");
    expect(readFileSync(invocation.environment.FIXTURE_SENTINEL!, "utf8")).toBe("resource\n");
  });

  it("refuses an undiscovered URI without invoking any primitive", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-resource-"));
    const invocation = resourceInvocation(root, "bubu-dictionary://not-listed");
    await expect(readMcpStdioResource(invocation)).rejects.toThrow("not present");
    expect(existsSync(invocation.environment.FIXTURE_SENTINEL!)).toBe(false);
  });
});
