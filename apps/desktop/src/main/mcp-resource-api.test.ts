import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mcpResourceReadBudget, type McpResourceReadResult } from "@bubu/contracts";
import { createMcpAuditStore } from "./mcp-audit-store.js";
import type { ResolvedMcpConnection } from "./mcp-connection-store.js";
import { createMcpResourceApprovalSessionStore } from "./mcp-resource-approval-sessions.js";
import {
  executeApprovedMcpResourceRead,
  prepareMcpResourceReadInvocation,
} from "./mcp-resource-api.js";
import { RpcRemoteError } from "./rpc-broker.js";

const connectionId = "a".repeat(32);
const resourceUri = "bubu-dictionary://definitions";

function resolved(name = "Dictionary"): ResolvedMcpConnection {
  return {
    profile: {
      id: connectionId,
      name,
      transport: {
        kind: "stdio",
        command: process.execPath,
        args: ["fixture.mjs"],
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
    },
    environment: { DICTIONARY_TOKEN: "secret" },
  };
}

const result: McpResourceReadResult = {
  schemaVersion: 1,
  connectionId,
  requestedUri: resourceUri,
  contents: [{
    kind: "text",
    uri: resourceUri,
    text: "local content",
    decodedBytes: 13,
  }],
  decodedBytes: 13,
  localOnly: true,
  untrustedContent: true,
};

describe("MCP resource desktop orchestration", () => {
  it("prepares one canonical exact-URI invocation with fixed budgets", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-resource-api-"));
    expect(prepareMcpResourceReadInvocation(resolved(), join(root, "runtimes"), resourceUri)).toEqual({
      connectionId,
      command: realpathSync(process.execPath),
      args: ["fixture.mjs"],
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: join(root, "runtimes", connectionId),
      resourceUri,
      budget: mcpResourceReadBudget,
    });
  });

  it("appends audit start before I/O and exactly one successful outcome", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-resource-api-"));
    const approvals = createMcpResourceApprovalSessionStore({ now: () => 1_000, newToken: () => "c".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpResourceReadInvocation(resolved(), join(root, "runtimes"), resourceUri);
    const proposal = approvals.issue("Dictionary", invocation);
    const trace: string[] = [];
    const read = async () => {
      trace.push(audits.list()[0]?.status ?? "missing-audit");
      return result;
    };
    await expect(executeApprovedMcpResourceRead(proposal.approvalToken, new AbortController().signal, {
      connections: { resolve: () => resolved() },
      approvals,
      audits,
      runtimeDirectory: join(root, "runtimes"),
      read,
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).resolves.toEqual(result);
    expect(trace).toEqual(["in-progress"]);
    expect(audits.list()[0]).toMatchObject({
      status: "succeeded",
      resourceUri,
      contentParts: 1,
      decodedBytes: 13,
    });
  });

  it("blocks drift before audit/process I/O and audits normalized operation failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-resource-api-"));
    const approvals = createMcpResourceApprovalSessionStore({ now: () => 1_000, newToken: () => "d".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpResourceReadInvocation(resolved(), join(root, "runtimes"), resourceUri);
    const drifted = approvals.issue("Dictionary", invocation);
    let called = false;
    await expect(executeApprovedMcpResourceRead(drifted.approvalToken, new AbortController().signal, {
      connections: { resolve: () => resolved("Renamed") }, approvals, audits,
      runtimeDirectory: join(root, "runtimes"),
      read: async () => { called = true; return result; },
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("重新审查");
    expect(called).toBe(false);
    expect(audits.list()).toEqual([]);

    const failing = approvals.issue("Dictionary", invocation);
    await expect(executeApprovedMcpResourceRead(failing.approvalToken, new AbortController().signal, {
      connections: { resolve: () => resolved() }, approvals, audits,
      runtimeDirectory: join(root, "runtimes"),
      read: async () => { throw new RpcRemoteError("MCP_RESOURCE_READ_FAILED", "server failed", false); },
      now: () => "2026-07-17T10:00:01Z",
      newAuditId: () => "223e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("server failed");
    expect(audits.list()[0]).toMatchObject({ status: "failed", errorCode: "MCP_RESOURCE_READ_FAILED" });
  });
});
