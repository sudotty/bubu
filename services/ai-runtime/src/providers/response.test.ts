import { describe, expect, it } from "vitest";
import { parseModelInvocation, type ProviderKind } from "@bubu/contracts";
import { parseProviderResponse } from "./response.js";

function invocation(kind: ProviderKind) {
  return parseModelInvocation({
    provider: {
      id: "a".repeat(32),
      name: kind,
      kind,
      baseUrl: kind === "ollama" ? "http://localhost:11434/v1/" : "https://models.example/v1/",
      model: "configured-model",
    },
    credential: kind === "ollama" ? "" : "secret",
    system: "System",
    user: "User",
  });
}

describe("provider response adapters", () => {
  it("normalizes Responses API output", () => {
    expect(
      parseProviderResponse(invocation("openai"), {
        output: [{ content: [{ type: "output_text", text: "answer" }] }],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    ).toMatchObject({ text: "answer", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
  });

  it("normalizes Anthropic, Gemini, and compatible output", () => {
    expect(
      parseProviderResponse(invocation("anthropic"), {
        content: [{ type: "text", text: "claude" }],
        usage: { input_tokens: 8, output_tokens: 4 },
      }).text,
    ).toBe("claude");
    expect(
      parseProviderResponse(invocation("gemini"), {
        steps: [{ type: "model_output", content: [{ type: "text", text: "gemini" }] }],
        usage: { total_input_tokens: 7, total_output_tokens: 3, total_tokens: 10 },
      }).text,
    ).toBe("gemini");
    expect(
      parseProviderResponse(invocation("openai-compatible"), {
        choices: [{ message: { content: "compatible" } }],
      }).text,
    ).toBe("compatible");
  });

  it("rejects empty or malformed provider output", () => {
    expect(() => parseProviderResponse(invocation("anthropic"), { content: [] })).toThrow(
      "no text",
    );
    expect(() => parseProviderResponse(invocation("gemini"), { outputs: [] })).toThrow();
  });
});
