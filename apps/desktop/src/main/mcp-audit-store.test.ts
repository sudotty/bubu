import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { McpAuditStart } from "@bubu/contracts";
import { createMcpAuditStore } from "./mcp-audit-store.js";

const auditId = "123e4567-e89b-42d3-a456-426614174000";
const start: McpAuditStart = {
  auditId,
  connectionId: "a".repeat(32),
  connectionName: "Dictionary",
  operation: "resource-read",
  resourceUri: "bubu-dictionary://definitions",
  requestFingerprint: "b".repeat(64),
  startedAt: "2026-07-17T10:00:00Z",
};

describe("MCP append-only audit store", () => {
  it("creates private immutable starts and outcomes without resource content", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-"));
    const store = createMcpAuditStore({ directory });
    store.start(start);
    expect(store.list()[0]).toMatchObject({ auditId, status: "in-progress" });
    store.finish({
      auditId,
      status: "succeeded",
      completedAt: "2026-07-17T10:00:01Z",
      contentParts: 1,
      decodedBytes: 37,
    });
    expect(store.list()[0]).toMatchObject({ auditId, status: "succeeded", decodedBytes: 37 });

    const startPath = join(directory, "starts", `${auditId}.json`);
    const outcomePath = join(directory, "outcomes", `${auditId}.json`);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "starts")).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "outcomes")).mode & 0o777).toBe(0o700);
    expect(statSync(startPath).mode & 0o777).toBe(0o600);
    expect(statSync(outcomePath).mode & 0o777).toBe(0o600);
    expect(`${readFileSync(startPath, "utf8")}${readFileSync(outcomePath, "utf8")}`).not.toContain("Revenue minus cost");
    expect(() => store.start(start)).toThrow("already exists");
    expect(() => store.finish({
      auditId,
      status: "failed",
      completedAt: "2026-07-17T10:00:02Z",
      errorCode: "MCP_RESOURCE_READ_FAILED",
    })).toThrow("already exists");
  });

  it("recovers unfinished starts as interrupted and fails closed on corruption or capacity", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-"));
    const first = createMcpAuditStore({ directory, maximumStarts: 1 });
    first.start(start);
    const recovered = createMcpAuditStore({ directory, maximumStarts: 1 });
    expect(recovered.list()[0]).toMatchObject({ auditId, status: "interrupted" });
    expect(() => recovered.start({
      ...start,
      auditId: "223e4567-e89b-42d3-a456-426614174000",
    })).toThrow("limit");

    const corruptDirectory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-corrupt-"));
    const bootstrap = createMcpAuditStore({ directory: corruptDirectory });
    expect(bootstrap.list()).toEqual([]);
    writeFileSync(join(corruptDirectory, "starts", `${auditId}.json`), "{broken", { mode: 0o600 });
    expect(() => createMcpAuditStore({ directory: corruptDirectory })).toThrow();
  });

  it("rejects an outcome without a matching append-only start", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-"));
    const store = createMcpAuditStore({ directory });
    expect(() => store.finish({
      auditId,
      status: "failed",
      completedAt: "2026-07-17T10:00:01Z",
      errorCode: "MCP_RESOURCE_READ_FAILED",
    })).toThrow("does not exist");
  });

  it("persists value-free prompt-get metadata through the same strict append-only path", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-prompt-"));
    const store = createMcpAuditStore({ directory });
    const promptAuditId = "323e4567-e89b-42d3-a456-426614174000";
    store.start({
      auditId: promptAuditId,
      connectionId: "a".repeat(32),
      connectionName: "Dictionary",
      operation: "prompt-get",
      promptName: "explain_term",
      argumentKeys: ["term"],
      argumentBytes: 23,
      requestFingerprint: "c".repeat(64),
      startedAt: "2026-07-17T11:00:00Z",
    });
    store.finish({
      auditId: promptAuditId,
      status: "succeeded",
      completedAt: "2026-07-17T11:00:01Z",
      contentParts: 2,
      decodedBytes: 42,
    });
    expect(store.list()[0]).toMatchObject({
      operation: "prompt-get",
      promptName: "explain_term",
      argumentKeys: ["term"],
      status: "succeeded",
    });
    const persisted = `${readFileSync(join(directory, "starts", `${promptAuditId}.json`), "utf8")}${readFileSync(join(directory, "outcomes", `${promptAuditId}.json`), "utf8")}`;
    expect(persisted).not.toContain("gross margin");
    expect(persisted).not.toContain("prompt result");
  });

  it("persists only tool name, schema, keys, and byte count for approved tool calls", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-audit-tool-"));
    const store = createMcpAuditStore({ directory });
    const toolAuditId = "423e4567-e89b-42d3-a456-426614174000";
    store.start({
      auditId: toolAuditId,
      connectionId: "a".repeat(32),
      connectionName: "Dictionary",
      operation: "tool-call",
      toolName: "lookup_term",
      inputSchemaSha256: "d".repeat(64),
      inputKeys: ["term"],
      inputBytes: 23,
      requestFingerprint: "e".repeat(64),
      startedAt: "2026-07-17T12:00:00Z",
    });
    store.finish({
      auditId: toolAuditId,
      status: "succeeded",
      completedAt: "2026-07-17T12:00:01Z",
      contentParts: 1,
      decodedBytes: 37,
    });
    expect(store.list()[0]).toMatchObject({
      operation: "tool-call",
      toolName: "lookup_term",
      inputKeys: ["term"],
      inputBytes: 23,
      status: "succeeded",
    });
    const persisted = `${readFileSync(join(directory, "starts", `${toolAuditId}.json`), "utf8")}${readFileSync(join(directory, "outcomes", `${toolAuditId}.json`), "utf8")}`;
    expect(persisted).not.toContain("gross margin");
    expect(persisted).not.toContain("Revenue minus cost");
  });
});
