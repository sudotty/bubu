import { describe, expect, it } from "vitest";
import { createMcpModelApprovalSessionStore } from "./mcp-model-approval-sessions.js";

const destination = { providerId: "a".repeat(32), providerKind: "openai" as const, providerName: "Provider", model: "model", endpointOrigin: "https://api.example.com" };
const promptPreparation = { purpose: "Summarize", prompt: { schemaVersion: 1 as const, connectionId: "b".repeat(32), promptName: "daily", messages: [{ role: "user" as const, content: { kind: "text" as const, text: "Daily summary", decodedBytes: 13 } }], decodedBytes: 13, localOnly: true as const, untrustedContent: true as const } };
const toolPreparation = { connectionId: "b".repeat(32), connectionName: "Local", goal: "Find one order", tools: [{ name: "find_order", inputSchemaJson: '{"additionalProperties":false,"properties":{"id":{"type":"string"}},"required":["id"],"type":"object"}', taskSupport: "forbidden" as const }] };

describe("MCP model approval sessions", () => {
  it("separates prompt and tool authority and consumes it once", () => {
    let token = 0;
    const store = createMcpModelApprovalSessionStore({ now: () => 1_000, newToken: () => `${++token}`.repeat(64).slice(0, 64) });
    const prompt = store.issuePrompt(promptPreparation, destination, 100, "c".repeat(64));
    expect(() => store.consumeTool(prompt.approvalToken)).toThrow("does not authorize");
    expect(() => store.consumePrompt(prompt.approvalToken)).toThrow("already been used");
    const tool = store.issueTool(toolPreparation, destination, 200, "d".repeat(64));
    expect(store.consumeTool(tool.approvalToken).preparation.goal).toBe("Find one order");
    expect(() => store.consumeTool(tool.approvalToken)).toThrow("already been used");
  });

  it("expires undisclosed authority", () => {
    let now = 1_000;
    const store = createMcpModelApprovalSessionStore({ now: () => now, newToken: () => "e".repeat(64) });
    const proposal = store.issuePrompt(promptPreparation, destination, 100, "f".repeat(64));
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consumePrompt(proposal.approvalToken)).toThrow("expired");
  });
});
