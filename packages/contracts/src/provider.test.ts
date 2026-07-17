import { describe, expect, it } from "vitest";
import {
  parseModelInvocation,
  parseProviderConfigurationInput,
  parseProviderRegistryState,
} from "./provider.js";

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

  it("keeps write-only credentials out of registry responses", () => {
    expect(
      parseProviderConfigurationInput({
        name: "OpenAI",
        kind: "openai",
        baseUrl: "https://api.openai.com/v1/",
        model: "configured-model",
        credential: "write-only-secret",
      }),
    ).toMatchObject({ credential: "write-only-secret" });

    expect(() =>
      parseProviderRegistryState({
        providers: [{ profile: provider, hasCredential: true, credential: "must-not-return" }],
        activeProviderId: provider.id,
        encryptionAvailable: true,
      }),
    ).toThrow();
  });

  it("rejects active provider references that are not in the registry", () => {
    expect(() =>
      parseProviderRegistryState({
        providers: [],
        activeProviderId: provider.id,
        encryptionAvailable: true,
      }),
    ).toThrow("Active provider");
  });
});
