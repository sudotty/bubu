import { describe, expect, it } from "vitest";
import { parseMcpModelToolPreparation, parseMcpModelToolSuggestionText, parseMcpPromptModelAnswerText, parseMcpPromptModelProposal } from "./mcp-model.js";

const id = "a".repeat(32);
const prompt = { schemaVersion: 1, connectionId: id, promptName: "explain", messages: [{ role: "user", content: { kind: "text", text: "Explain margin", decodedBytes: 14 } }], decodedBytes: 14, localOnly: true, untrustedContent: true } as const;
const destination = { providerId: "b".repeat(32), providerKind: "openai" as const, providerName: "Provider", model: "model", endpointOrigin: "https://api.example.com" };
const tool = { name: "lookup", inputSchemaJson: '{"additionalProperties":false,"properties":{"term":{"type":"string"}},"required":["term"],"type":"object"}', taskSupport: "forbidden" as const };

describe("MCP model bridge contracts", () => {
  it("binds an exact untrusted prompt to a separate model approval", () => {
    const proposal = parseMcpPromptModelProposal({ approvalToken: "c".repeat(64), expiresAt: "2026-07-29T00:10:00Z", destination, preparation: { purpose: "Explain for review", prompt }, payloadBytes: 100, payloadSha256: "d".repeat(64), warning: "untrusted-mcp-prompt-to-model" });
    expect(parseMcpPromptModelAnswerText('{"schemaVersion":1,"response":"Bounded answer"}', proposal).disclosure.promptName).toBe("explain");
  });

  it("allows exactly one disclosed schema-valid tool suggestion", () => {
    const preparation = parseMcpModelToolPreparation({ connectionId: id, connectionName: "Local server", goal: "Look up gross margin", tools: [tool] });
    expect(parseMcpModelToolSuggestionText('{"schemaVersion":1,"toolName":"lookup","arguments":{"term":"gross margin"}}', preparation).toolName).toBe("lookup");
    expect(() => parseMcpModelToolSuggestionText('{"schemaVersion":1,"toolName":"delete_all","arguments":{}}', preparation)).toThrow("undisclosed");
    expect(() => parseMcpModelToolSuggestionText('{"schemaVersion":1,"toolName":"lookup","arguments":{}}', preparation)).toThrow();
  });
});
