import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mcpPromptGetBudget, type McpPromptGetInvocation, type McpPromptGetResult } from "@bubu/contracts";
import { createMcpAuditStore } from "./mcp-audit-store.js";
import type { ResolvedMcpConnection } from "./mcp-connection-store.js";
import { createMcpPromptApprovalSessionStore } from "./mcp-prompt-approval-sessions.js";
import {
  executeApprovedMcpPromptGet,
  prepareMcpPromptGetInvocation,
} from "./mcp-prompt-api.js";
import { RpcRemoteError } from "./rpc-broker.js";

const connectionId = "a".repeat(32);
const promptName = "explain-term";
const promptArguments: McpPromptGetInvocation["arguments"] = [{ name: "term", value: "gross margin" }];

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

const result: McpPromptGetResult = {
  schemaVersion: 1,
  connectionId,
  promptName,
  messages: [{
    role: "user",
    content: { kind: "text", text: "local prompt", decodedBytes: 12 },
  }],
  decodedBytes: 12,
  localOnly: true,
  untrustedContent: true,
};

describe("MCP prompt desktop orchestration", () => {
  it("prepares one canonical exact-prompt invocation with fixed budgets", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-prompt-api-"));
    expect(prepareMcpPromptGetInvocation(
      resolved(), join(root, "runtimes"), promptName, promptArguments,
    )).toEqual({
      connectionId,
      command: realpathSync(process.execPath),
      args: ["fixture.mjs"],
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: join(root, "runtimes", connectionId),
      promptName,
      arguments: promptArguments,
      budget: mcpPromptGetBudget,
    });
  });

  it("appends content-free audit start before I/O and exactly one successful outcome", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-prompt-api-"));
    const approvals = createMcpPromptApprovalSessionStore({ now: () => 1_000, newToken: () => "c".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpPromptGetInvocation(resolved(), join(root, "runtimes"), promptName, promptArguments);
    const proposal = approvals.issue("Dictionary", invocation);
    const trace: string[] = [];
    const get = async () => {
      trace.push(audits.list()[0]?.status ?? "missing-audit");
      return result;
    };
    await expect(executeApprovedMcpPromptGet(proposal.approvalToken, {
      connectionId, promptName, arguments: promptArguments,
    }, new AbortController().signal, {
      connections: { resolve: () => resolved() }, approvals, audits,
      runtimeDirectory: join(root, "runtimes"), get,
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).resolves.toEqual(result);
    expect(trace).toEqual(["in-progress"]);
    expect(audits.list()[0]).toMatchObject({
      status: "succeeded",
      operation: "prompt-get",
      promptName,
      argumentKeys: ["term"],
      contentParts: 1,
      decodedBytes: 12,
    });
    expect(JSON.stringify(audits.list())).not.toContain("gross margin");
  });

  it("blocks drift before audit/process I/O and audits normalized operation failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-prompt-api-"));
    const approvals = createMcpPromptApprovalSessionStore({ now: () => 1_000, newToken: () => "d".repeat(64) });
    const audits = createMcpAuditStore({ directory: join(root, "audits") });
    const invocation = prepareMcpPromptGetInvocation(resolved(), join(root, "runtimes"), promptName, promptArguments);
    const drifted = approvals.issue("Dictionary", invocation);
    let called = false;
    await expect(executeApprovedMcpPromptGet(drifted.approvalToken, {
      connectionId, promptName, arguments: [{ name: "term", value: "gross profit" }],
    }, new AbortController().signal, {
      connections: { resolve: () => resolved("Renamed") }, approvals, audits,
      runtimeDirectory: join(root, "runtimes"),
      get: async () => { called = true; return result; },
      now: () => "2026-07-17T10:00:00Z",
      newAuditId: () => "123e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("重新审查");
    expect(called).toBe(false);
    expect(audits.list()).toEqual([]);

    const failing = approvals.issue("Dictionary", invocation);
    await expect(executeApprovedMcpPromptGet(failing.approvalToken, {
      connectionId, promptName, arguments: promptArguments,
    }, new AbortController().signal, {
      connections: { resolve: () => resolved() }, approvals, audits,
      runtimeDirectory: join(root, "runtimes"),
      get: async () => { throw new RpcRemoteError("MCP_PROMPT_GET_FAILED", "server failed", false); },
      now: () => "2026-07-17T10:00:01Z",
      newAuditId: () => "223e4567-e89b-42d3-a456-426614174000",
    })).rejects.toThrow("server failed");
    expect(audits.list()[0]).toMatchObject({ status: "failed", errorCode: "MCP_PROMPT_GET_FAILED" });
  });
});
