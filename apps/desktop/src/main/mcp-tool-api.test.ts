import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalMcpJson,
  mcpToolCallBudget,
  type McpToolCallRequest,
  type McpToolCallResult,
} from "@bubu/contracts";
import { createMcpAuditStore } from "./mcp-audit-store.js";
import type { ResolvedMcpConnection } from "./mcp-connection-store.js";
import { createMcpToolApprovalSessionStore } from "./mcp-tool-approval-sessions.js";
import { executeApprovedMcpToolCall, prepareMcpToolCallInvocation } from "./mcp-tool-api.js";
import { RpcRemoteError } from "./rpc-broker.js";

const connectionId = "a".repeat(32);
const inputSchemaJson = canonicalMcpJson({
  type: "object",
  properties: { term: { type: "string" } },
  required: ["term"],
  additionalProperties: false,
});
const request: McpToolCallRequest = {
  connectionId,
  toolName: "lookup_term",
  inputSchemaJson,
  taskSupport: "forbidden",
  arguments: { term: "gross margin" },
};

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

const result: McpToolCallResult = {
  schemaVersion: 1,
  connectionId,
  toolName: request.toolName,
  isError: false,
  contents: [{ kind: "text", text: "Definition for gross margin", decodedBytes: 27 }],
  structuredContent: { json: "{\"definition\":\"Definition for gross margin\"}", decodedBytes: 44 },
  decodedBytes: 71,
  localOnly: true,
  untrustedContent: true,
};

describe("MCP tool desktop orchestration", () => {
  it("prepares a canonical invocation with exact schema hash, arguments, and fixed budgets", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-tool-api-"));
    const invocation = prepareMcpToolCallInvocation(resolved(), join(root, "runtimes"), request);
    expect(invocation).toMatchObject({
      connectionId,
      command: realpathSync(process.execPath),
      arguments: request.arguments,
      toolName: request.toolName,
      taskSupport: "forbidden",
      budget: mcpToolCallBudget,
    });
    expect(invocation.inputSchemaSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("records content-free audit start before I/O and one successful outcome", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-tool-api-"));
    const runtimeDirectory = join(root, "runtimes");
    const approvals = createMcpToolApprovalSessionStore({ now: () => 1_000, newToken: () => "c".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpToolCallInvocation(resolved(), runtimeDirectory, request);
    const proposal = approvals.issue("Dictionary", request, invocation);
    const trace: string[] = [];
    await expect(executeApprovedMcpToolCall(proposal.approvalToken, request, new AbortController().signal, {
      connections: { resolve: () => resolved() }, approvals, audits, runtimeDirectory,
      call: async () => { trace.push(audits.list()[0]?.status ?? "missing-audit"); return result; },
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).resolves.toEqual(result);
    expect(trace).toEqual(["in-progress"]);
    expect(audits.list()[0]).toMatchObject({
      status: "succeeded",
      operation: "tool-call",
      toolName: request.toolName,
      inputKeys: ["term"],
      inputBytes: 23,
      contentParts: 1,
      decodedBytes: 71,
    });
    expect(JSON.stringify(audits.list()[0])).not.toContain("gross margin");
  });

  it("blocks post-approval drift and audits normalized runtime failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-tool-api-"));
    const runtimeDirectory = join(root, "runtimes");
    const approvals = createMcpToolApprovalSessionStore({ now: () => 1_000, newToken: () => "d".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpToolCallInvocation(resolved(), runtimeDirectory, request);
    const drifted = approvals.issue("Dictionary", request, invocation);
    let called = false;
    await expect(executeApprovedMcpToolCall(drifted.approvalToken, request, new AbortController().signal, {
      connections: { resolve: () => resolved("Renamed") }, approvals, audits, runtimeDirectory,
      call: async () => { called = true; return result; },
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("重新审查");
    expect(called).toBe(false);
    expect(audits.list()).toEqual([]);

    const failing = approvals.issue("Dictionary", request, invocation);
    await expect(executeApprovedMcpToolCall(failing.approvalToken, request, new AbortController().signal, {
      connections: { resolve: () => resolved() }, approvals, audits, runtimeDirectory,
      call: async () => { throw new RpcRemoteError("MCP_TOOL_CALL_FAILED", "server failed", false); },
      now: () => "2026-07-17T10:00:01Z",
      newAuditId: () => "223e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("server failed");
    expect(audits.list()[0]).toMatchObject({ status: "failed", errorCode: "MCP_TOOL_CALL_FAILED" });
  });
});
