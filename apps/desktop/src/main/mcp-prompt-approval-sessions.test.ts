import { describe, expect, it } from "vitest";
import { mcpPromptGetBudget, type McpPromptGetInvocation } from "@bubu/contracts";
import { createMcpPromptApprovalSessionStore } from "./mcp-prompt-approval-sessions.js";

const invocation: McpPromptGetInvocation = {
  connectionId: "a".repeat(32),
  command: "/private/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio", "--read-only"],
  environment: { DICTIONARY_TOKEN: "secret" },
  workingDirectory: "/private/tmp/bubu-mcp/a",
  promptName: "explain_term",
  arguments: [{ name: "term", value: "gross margin" }],
  budget: mcpPromptGetBudget,
};

describe("MCP prompt approval sessions", () => {
  it("shows exact argument values but stores separate secret-bound and value-free fingerprints", () => {
    const store = createMcpPromptApprovalSessionStore({
      now: () => Date.parse("2026-07-17T11:00:00Z"),
      newToken: () => "a".repeat(64),
    });
    const proposal = store.issue("Dictionary", invocation);
    expect(proposal).toMatchObject({
      connection: {
        id: invocation.connectionId,
        name: "Dictionary",
        command: invocation.command,
        args: invocation.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      promptName: invocation.promptName,
      arguments: invocation.arguments,
      budget: mcpPromptGetBudget,
      warning: "untrusted-local-code-argument-disclosure-and-content",
    });
    expect(JSON.stringify(proposal)).toContain("gross margin");
    expect(JSON.stringify(proposal)).not.toContain("secret");
    const approved = store.consume(proposal.approvalToken);
    expect(approved).toMatchObject({
      name: "Dictionary",
      connectionId: invocation.connectionId,
      promptName: invocation.promptName,
      argumentKeys: ["term"],
      argumentBytes: 23,
    });
    expect(approved.requestFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(approved.launchFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(approved)).not.toContain("gross margin");
    expect(JSON.stringify(approved)).not.toContain("secret");
    expect(store.matches(approved, "Dictionary", invocation)).toBe(true);

    const valueDrift = {
      ...invocation,
      environment: { DICTIONARY_TOKEN: "changed" },
      arguments: [{ name: "term", value: "gross profit" }],
    };
    expect(store.matches(approved, "Dictionary", valueDrift)).toBe(false);
    const secondStore = createMcpPromptApprovalSessionStore({
      now: () => Date.parse("2026-07-17T11:00:00Z"),
      newToken: () => "b".repeat(64),
    });
    const second = secondStore.consume(secondStore.issue("Dictionary", valueDrift).approvalToken);
    expect(second.requestFingerprint).toBe(approved.requestFingerprint);
    expect(second.launchFingerprint).not.toBe(approved.launchFingerprint);
    expect(() => store.consume(proposal.approvalToken)).toThrow();
  });

  it("expires at the exact boundary, revokes, and evicts old unused prompt approvals", () => {
    let now = 1_000;
    let token = 0;
    const store = createMcpPromptApprovalSessionStore({
      now: () => now,
      newToken: () => (token++).toString(16).padStart(64, "0"),
    });
    const revoked = store.issue("Dictionary", invocation);
    store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow();
    const expired = store.issue("Dictionary", invocation);
    now += 10 * 60 * 1_000;
    expect(() => store.consume(expired.approvalToken)).toThrow();
    now += 1;
    const issued = Array.from({ length: 21 }, () => store.issue("Dictionary", invocation));
    expect(() => store.consume(issued[0]!.approvalToken)).toThrow();
    expect(store.consume(issued[20]!.approvalToken).promptName).toBe(invocation.promptName);
  });
});
