import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRemoteMcpAuditStore } from "./remote-mcp-audit-store.js";

describe("remote MCP append-only audit", () => {
  it("persists a value-free start and exactly one outcome", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-remote-audit-")); const store = createRemoteMcpAuditStore(directory); const auditId = "123e4567-e89b-42d3-a456-426614174000";
    store.start({ auditId, connectionId: "a".repeat(32), connectionName: "Remote", operation: "remote-tool-call", endpointOrigin: "https://mcp.example.com", requestFingerprint: "b".repeat(64), toolName: "lookup", inputSchemaSha256: "c".repeat(64), inputKeys: ["id"], inputBytes: 11, startedAt: "2026-07-29T00:00:00Z" });
    expect(store.list()[0]?.status).toBe("in-progress");
    store.finish({ auditId, status: "succeeded", completedAt: "2026-07-29T00:00:01Z", contentParts: 1, decodedBytes: 20 });
    expect(store.list()[0]).toMatchObject({ status: "succeeded", toolName: "lookup" });
    expect(() => store.finish({ auditId, status: "failed", completedAt: "2026-07-29T00:00:02Z", errorCode: "FAILED" })).toThrow("cannot be finished");
    expect(JSON.stringify(store.list())).not.toContain("secret");
    expect(createRemoteMcpAuditStore(directory).list()[0]?.status).toBe("succeeded");
  });

  it("rejects an outcome timestamp before the operation start", () => {
    const store = createRemoteMcpAuditStore(mkdtempSync(join(tmpdir(), "bubu-remote-audit-time-")));
    const auditId = "123e4567-e89b-42d3-a456-426614174001";
    store.start({ auditId, connectionId: "a".repeat(32), connectionName: "Remote", operation: "remote-inspect", endpointOrigin: "https://mcp.example.com", requestFingerprint: "b".repeat(64), startedAt: "2026-07-29T00:00:02Z" });
    expect(() => store.finish({ auditId, status: "failed", completedAt: "2026-07-29T00:00:01Z", errorCode: "FAILED" })).toThrow("cannot be finished");
  });
});
