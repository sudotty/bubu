import { describe, expect, it } from "vitest";
import { mcpResourceReadBudget, type McpResourceReadInvocation } from "@bubu/contracts";
import { createMcpResourceApprovalSessionStore } from "./mcp-resource-approval-sessions.js";

const invocation: McpResourceReadInvocation = {
  connectionId: "a".repeat(32),
  command: "/private/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio", "--read-only"],
  environment: { DICTIONARY_TOKEN: "secret" },
  workingDirectory: "/private/tmp/bubu-mcp/a",
  resourceUri: "bubu-dictionary://definitions",
  budget: mcpResourceReadBudget,
};

describe("MCP resource approval sessions", () => {
  it("issues an exact redacted proposal and stores only a request fingerprint", () => {
    const store = createMcpResourceApprovalSessionStore({
      now: () => Date.parse("2026-07-17T10:00:00Z"),
      newToken: () => "c".repeat(64),
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
      resourceUri: invocation.resourceUri,
      budget: mcpResourceReadBudget,
      warning: "untrusted-local-code-and-content",
    });
    expect(JSON.stringify(proposal)).not.toContain("secret");
    const approved = store.consume(proposal.approvalToken);
    expect(approved).toMatchObject({
      name: "Dictionary",
      connectionId: invocation.connectionId,
      resourceUri: invocation.resourceUri,
    });
    expect(approved.requestFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(approved.launchFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(approved)).not.toContain("secret");
    expect(store.matches(approved, "Dictionary", invocation)).toBe(true);
    const secretDrift = { ...invocation, environment: { DICTIONARY_TOKEN: "different-secret" } };
    expect(store.matches(approved, "Dictionary", secretDrift)).toBe(false);
    const secondStore = createMcpResourceApprovalSessionStore({
      now: () => Date.parse("2026-07-17T10:00:00Z"),
      newToken: () => "d".repeat(64),
    });
    const second = secondStore.consume(secondStore.issue("Dictionary", secretDrift).approvalToken);
    expect(second.requestFingerprint).toBe(approved.requestFingerprint);
    expect(second.launchFingerprint).not.toBe(approved.launchFingerprint);
    expect(store.matches(approved, "Dictionary", { ...invocation, resourceUri: "bubu-dictionary://other" })).toBe(false);
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("expires at the exact boundary, revokes, and evicts old unused approvals", () => {
    let now = 1_000;
    let token = 0;
    const store = createMcpResourceApprovalSessionStore({
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
    expect(store.consume(issued[20]!.approvalToken).connectionId).toBe(invocation.connectionId);
  });
});
