import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  canonicalMcpJson,
  mcpToolCallBudget,
  type McpToolCallInvocation,
  type McpToolCallRequest,
} from "@bubu/contracts";
import { createMcpToolApprovalSessionStore } from "./mcp-tool-approval-sessions.js";

const inputSchemaJson = canonicalMcpJson({
  type: "object",
  properties: { term: { type: "string" } },
  required: ["term"],
  additionalProperties: false,
});
const inputSchemaSha256 = createHash("sha256").update(inputSchemaJson, "utf8").digest("hex");
const request: McpToolCallRequest = {
  connectionId: "a".repeat(32),
  toolName: "lookup_term",
  inputSchemaJson,
  taskSupport: "forbidden",
  arguments: { term: "gross margin" },
};
const invocation: McpToolCallInvocation = {
  connectionId: request.connectionId,
  command: "/private/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio", "--read-only"],
  environment: { DICTIONARY_TOKEN: "secret" },
  workingDirectory: "/private/tmp/bubu-mcp/a",
  toolName: request.toolName,
  inputSchemaSha256,
  taskSupport: request.taskSupport,
  arguments: request.arguments,
  budget: mcpToolCallBudget,
};

describe("MCP tool approval sessions", () => {
  it("shows exact input but retains only secret/value-bound and public value-free fingerprints", () => {
    const store = createMcpToolApprovalSessionStore({
      now: () => Date.parse("2026-07-17T12:00:00Z"),
      newToken: () => "a".repeat(64),
    });
    const proposal = store.issue("Dictionary", request, invocation);
    expect(proposal).toMatchObject({
      connection: {
        id: invocation.connectionId,
        name: "Dictionary",
        command: invocation.command,
        args: invocation.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      toolName: invocation.toolName,
      inputSchemaJson,
      inputSchemaSha256: invocation.inputSchemaSha256,
      taskSupport: "forbidden",
      arguments: invocation.arguments,
      budget: mcpToolCallBudget,
      warning: "untrusted-local-code-arguments-content-and-side-effects",
    });
    expect(JSON.stringify(proposal)).toContain("gross margin");
    expect(JSON.stringify(proposal)).not.toContain("secret");

    const approved = store.consume(proposal.approvalToken);
    expect(approved).toMatchObject({
      name: "Dictionary",
      connectionId: invocation.connectionId,
      toolName: invocation.toolName,
      inputSchemaSha256: invocation.inputSchemaSha256,
      taskSupport: "forbidden",
      inputKeys: ["term"],
      inputBytes: 23,
    });
    expect(approved.requestFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(approved.launchFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(approved)).not.toContain("gross margin");
    expect(JSON.stringify(approved)).not.toContain("secret");
    expect(store.matches(approved, "Dictionary", invocation)).toBe(true);

    const valueDrift: McpToolCallInvocation = {
      ...invocation,
      environment: { DICTIONARY_TOKEN: "changed" },
      arguments: { term: "gross profit" },
    };
    expect(store.matches(approved, "Dictionary", valueDrift)).toBe(false);
    const secondStore = createMcpToolApprovalSessionStore({
      now: () => Date.parse("2026-07-17T12:00:00Z"),
      newToken: () => "b".repeat(64),
    });
    const second = secondStore.consume(secondStore.issue("Dictionary", {
      ...request, arguments: valueDrift.arguments,
    }, valueDrift).approvalToken);
    expect(second.requestFingerprint).toBe(approved.requestFingerprint);
    expect(second.launchFingerprint).not.toBe(approved.launchFingerprint);
    expect(() => store.consume(proposal.approvalToken)).toThrow();
  });

  it("rejects request/invocation schema drift and expires, revokes, and evicts capabilities", () => {
    let now = 1_000;
    let token = 0;
    const store = createMcpToolApprovalSessionStore({
      now: () => now,
      newToken: () => (token++).toString(16).padStart(64, "0"),
    });
    expect(() => store.issue("Dictionary", request, {
      ...invocation, inputSchemaSha256: "b".repeat(64),
    })).toThrow("schema");
    const revoked = store.issue("Dictionary", request, invocation);
    store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow();
    const expired = store.issue("Dictionary", request, invocation);
    now += 10 * 60 * 1_000;
    expect(() => store.consume(expired.approvalToken)).toThrow();
    now += 1;
    const issued = Array.from({ length: 21 }, () => store.issue("Dictionary", request, invocation));
    expect(() => store.consume(issued[0]!.approvalToken)).toThrow();
    expect(store.consume(issued[20]!.approvalToken).toolName).toBe(invocation.toolName);
  });
});
