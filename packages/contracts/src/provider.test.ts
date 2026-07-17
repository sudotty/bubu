import { describe, expect, it } from "vitest";
import { parseModelInvocation } from "./provider.js";

const provider = {
  id: "a".repeat(32),
  name: "Private model",
  kind: "openai",
  baseUrl: "https://api.openai.com/v1/",
  model: "configured-model",
} as const;

describe("provider boundary", () => {
  it("parses an explicit bounded invocation", () => {
    expect(
      parseModelInvocation({ provider, credential: "secret", system: "System", user: "User" }),
    ).toEqual({
      provider,
      credential: "secret",
      system: "System",
      user: "User",
      maxOutputTokens: 2_048,
    });
  });

  it("rejects embedded provider secrets and unbounded output", () => {
    expect(() =>
      parseModelInvocation({
        provider: { ...provider, apiKey: "must-not-live-in-profile" },
        credential: "secret",
        system: "System",
        user: "User",
      }),
    ).toThrow();
    expect(() =>
      parseModelInvocation({
        provider,
        credential: "secret",
        system: "System",
        user: "User",
        maxOutputTokens: 100_000,
      }),
    ).toThrow();
  });
});
