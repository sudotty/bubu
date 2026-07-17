import { describe, expect, it } from "vitest";
import { parseModelInvocation, type ProviderKind } from "@bubu/contracts";
import { buildProviderRequest, parseProviderBaseUrl } from "./request.js";

const cases: ReadonlyArray<{
  readonly kind: ProviderKind;
  readonly baseUrl: string;
  readonly expectedUrl: string;
  readonly authHeader: string;
  readonly bodyField: string;
}> = [
  {
    kind: "openai",
    baseUrl: "https://api.openai.com/v1/",
    expectedUrl: "https://api.openai.com/v1/responses",
    authHeader: "authorization",
    bodyField: "instructions",
  },
  {
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1/",
    expectedUrl: "https://api.anthropic.com/v1/messages",
    authHeader: "x-api-key",
    bodyField: "system",
  },
  {
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1/",
    expectedUrl: "https://generativelanguage.googleapis.com/v1/interactions",
    authHeader: "x-goog-api-key",
    bodyField: "system_instruction",
  },
  {
    kind: "openai-compatible",
    baseUrl: "https://gateway.example/v1/",
    expectedUrl: "https://gateway.example/v1/chat/completions",
    authHeader: "authorization",
    bodyField: "messages",
  },
  {
    kind: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1/",
    expectedUrl: "http://127.0.0.1:11434/v1/responses",
    authHeader: "",
    bodyField: "instructions",
  },
];

describe("provider request adapters", () => {
  for (const test of cases) {
    it(`builds the ${test.kind} official transport`, () => {
      const invocation = parseModelInvocation({
        provider: {
          id: "a".repeat(32),
          name: test.kind,
          kind: test.kind,
          baseUrl: test.baseUrl,
          model: "configured-model",
        },
        credential: test.kind === "ollama" ? "" : "private-key",
        system: "SYSTEM-INSTRUCTION",
        user: "USER-QUESTION",
        maxOutputTokens: 1_024,
      });
      const request = buildProviderRequest(invocation);
      const body = JSON.parse(request.init.body) as Record<string, unknown>;

      expect(request.url).toBe(test.expectedUrl);
      expect(body.model).toBe("configured-model");
      expect(body[test.bodyField]).toBeDefined();
      expect(request.init.body).not.toContain("private-key");
      if (test.authHeader) expect(request.init.headers[test.authHeader]).toContain("private-key");
      else expect(request.init.headers.authorization).toBeUndefined();
    });
  }

  it("blocks plaintext remote endpoints and embedded URL credentials", () => {
    expect(() => parseProviderBaseUrl("http://models.example/v1/")).toThrow("HTTPS");
    expect(() => parseProviderBaseUrl("https://secret@models.example/v1/")).toThrow("credentials");
  });
});
