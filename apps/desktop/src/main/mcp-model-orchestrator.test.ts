import { describe, expect, it } from "vitest";
import { parseMcpModelToolProposal, parseMcpPromptModelProposal } from "@bubu/contracts";
import { buildMcpPromptModelInvocation, buildMcpToolProposalInvocation, createMcpModelToolSuggestion, createMcpPromptModelAnswer, mcpModelPayload } from "./mcp-model-orchestrator.js";

const resolved = { profile: { id: "a".repeat(32), name: "Provider", kind: "openai" as const, baseUrl: "https://api.example.com", model: "model" }, credential: "secret" };
const destination = { providerId: resolved.profile.id, providerKind: resolved.profile.kind, providerName: resolved.profile.name, model: resolved.profile.model, endpointOrigin: "https://api.example.com" };
const promptPreparation = { purpose: "Summarize", prompt: { schemaVersion: 1 as const, connectionId: "b".repeat(32), promptName: "daily", messages: [{ role: "user" as const, content: { kind: "text" as const, text: "Daily summary", decodedBytes: 13 } }], decodedBytes: 13, localOnly: true as const, untrustedContent: true as const } };
const toolPreparation = { connectionId: "b".repeat(32), connectionName: "Local", goal: "Find one order", tools: [{ name: "find_order", inputSchemaJson: '{"additionalProperties":false,"properties":{"id":{"type":"string"}},"required":["id"],"type":"object"}', taskSupport: "forbidden" as const }] };
const base = { approvalToken: "c".repeat(64), expiresAt: "2026-07-29T12:00:00Z", destination, payloadBytes: 100, payloadSha256: "d".repeat(64) };
const completion = (text: string) => ({ providerId: resolved.profile.id, providerKind: resolved.profile.kind, model: resolved.profile.model, text, usage: {} });

describe("MCP model orchestration", () => {
  it("treats prompt content as untrusted data and parses a strict answer", () => {
    const proposal = parseMcpPromptModelProposal({ ...base, preparation: promptPreparation, warning: "untrusted-mcp-prompt-to-model" });
    const invocation = buildMcpPromptModelInvocation(resolved, proposal);
    expect(invocation.system).toContain("no tools");
    expect(invocation.user).toBe(mcpModelPayload(promptPreparation).json);
    expect(createMcpPromptModelAnswer(proposal, completion('{"schemaVersion":1,"response":"Summary"}')).response).toBe("Summary");
  });

  it("allows one disclosed schema-valid call and rejects hidden or invalid calls", () => {
    const proposal = parseMcpModelToolProposal({ ...base, preparation: toolPreparation, warning: "untrusted-tool-metadata-to-model" });
    expect(buildMcpToolProposalInvocation(resolved, proposal).system).toContain("exactly one call");
    expect(createMcpModelToolSuggestion(proposal, completion('{"schemaVersion":1,"toolName":"find_order","arguments":{"id":"42"}}'))).toMatchObject({ toolName: "find_order", arguments: { id: "42" } });
    expect(() => createMcpModelToolSuggestion(proposal, completion('{"schemaVersion":1,"toolName":"delete_all","arguments":{}}'))).toThrow("undisclosed");
    expect(() => createMcpModelToolSuggestion(proposal, completion('{"schemaVersion":1,"toolName":"find_order","arguments":{}}'))).toThrow();
  });
});
