import { describe, expect, it } from "vitest";
import { createRemoteMcpInspectionApprovalStore } from "./remote-mcp-approval-sessions.js";

const profile = { id: "a".repeat(32), name: "Remote", serverUrl: "https://mcp.example.com/rpc", authorization: { kind: "none" as const }, authorizationStatus: "not-required" as const };
const request = { connectionId: profile.id, toolName: "lookup", inputSchemaJson: '{"additionalProperties":false,"properties":{"id":{"type":"string"}},"required":["id"],"type":"object"}', taskSupport: "forbidden" as const, arguments: { id: "42" } };

describe("remote MCP approvals", () => {
  it("does not reuse inspection authority for a tool and consumes each once", () => {
    let index = 0; const store = createRemoteMcpInspectionApprovalStore({ now: () => 1_000, newToken: () => `${++index}`.repeat(64).slice(0, 64) });
    const inspection = store.issue(profile); const tool = store.issueTool(profile, request);
    expect(store.consume(inspection.approvalToken).id).toBe(profile.id);
    expect(() => store.consume(inspection.approvalToken)).toThrow("already been used");
    expect(store.consumeTool(tool.approvalToken).request.arguments).toEqual({ id: "42" });
    expect(() => store.consumeTool(tool.approvalToken)).toThrow("already been used");
  });
});
