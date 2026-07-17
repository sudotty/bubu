import { describe, expect, it, vi } from "vitest";
import { parseModelInvocation } from "@bubu/contracts";
import { invokeProvider } from "./invoke.js";

describe("provider invocation", () => {
  it("sends the credential only in headers and parses the response", async () => {
    const fetchProvider = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: "Bearer private-key" });
      expect(String(init.body)).not.toContain("private-key");
      return new Response(
        JSON.stringify({ output: [{ content: [{ type: "output_text", text: "done" }] }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const result = await invokeProvider(
      parseModelInvocation({
        provider: {
          id: "a".repeat(32),
          name: "OpenAI",
          kind: "openai",
          baseUrl: "https://api.openai.com/v1/",
          model: "configured-model",
        },
        credential: "private-key",
        system: "System",
        user: "User",
      }),
      fetchProvider,
    );

    expect(result.text).toBe("done");
    expect(fetchProvider).toHaveBeenCalledOnce();
  });

  it("returns a bounded provider error without retrying implicitly", async () => {
    await expect(
      invokeProvider(
        parseModelInvocation({
          provider: {
            id: "a".repeat(32),
            name: "Anthropic",
            kind: "anthropic",
            baseUrl: "https://api.anthropic.com/v1/",
            model: "configured-model",
          },
          credential: "private-key",
          system: "System",
          user: "User",
        }),
        async () => new Response("rate limited", { status: 429 }),
      ),
    ).rejects.toMatchObject({ message: "anthropic request failed with HTTP 429", retryable: true });
  });
});
