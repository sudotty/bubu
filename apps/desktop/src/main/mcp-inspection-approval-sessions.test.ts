import { describe, expect, it } from "vitest";
import { mcpInspectionBudget, type McpInspectionInvocation } from "@bubu/contracts";
import { createMcpInspectionApprovalSessionStore } from "./mcp-inspection-approval-sessions.js";

const invocation: McpInspectionInvocation = {
  connectionId: "a".repeat(32),
  command: "/private/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio", "--read-only"],
  environment: { DICTIONARY_TOKEN: "secret" },
  workingDirectory: "/private/tmp/bubu-mcp/a",
  budget: mcpInspectionBudget,
};

describe("MCP inspection approval sessions", () => {
  it("issues a redacted exact-launch proposal and consumes the secret invocation once", () => {
    const store = createMcpInspectionApprovalSessionStore({
      now: () => Date.parse("2026-07-17T09:00:00Z"),
      newToken: () => "b".repeat(64),
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
      budget: mcpInspectionBudget,
      warning: "untrusted-local-code",
    });
    expect(JSON.stringify(proposal)).not.toContain("secret");
    const approved = store.consume(proposal.approvalToken);
    expect(approved).toMatchObject({ name: "Dictionary", connectionId: invocation.connectionId });
    expect(approved.invocationFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(approved)).not.toContain("secret");
    expect(store.matches(approved, "Dictionary", invocation)).toBe(true);
    expect(store.matches(approved, "Renamed", invocation)).toBe(false);
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("expires, revokes, and evicts old unused launch capabilities", () => {
    let now = 1_000;
    let token = 0;
    const store = createMcpInspectionApprovalSessionStore({
      now: () => now,
      newToken: () => (token++).toString(16).padStart(64, "0"),
    });
    const revoked = store.issue("Dictionary", invocation);
    store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow("expired or has already been used");

    const expiring = store.issue("Dictionary", invocation);
    now += 10 * 60 * 1_000;
    expect(() => store.consume(expiring.approvalToken)).toThrow("expired or has already been used");

    now += 1;
    const issued = Array.from({ length: 21 }, () => store.issue("Dictionary", invocation));
    expect(() => store.consume(issued[0]!.approvalToken)).toThrow("expired or has already been used");
    expect(store.consume(issued[20]!.approvalToken).connectionId).toBe(invocation.connectionId);
  });
});
