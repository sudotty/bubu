import { describe, expect, it } from "vitest";
import { createRpcRequest, parseServiceHealth } from "@bubu/contracts";
import { handleAiRuntimeRequest } from "./handler.js";

const auth = "a".repeat(64);

describe("AI runtime request handler", () => {
  it("returns versioned readiness for an authenticated health request", () => {
    const response = handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "health-1", method: "system.health", params: {} }),
      auth,
    );

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("expected success");
    expect(parseServiceHealth(response.result)).toEqual({
      service: "ai-runtime",
      protocolVersion: 1,
      status: "ready",
      capabilities: ["provider-registry", "streaming", "tools", "mcp"],
    });
  });

  it("does not execute a request with the wrong process token", () => {
    const response = handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "health-1", method: "system.health", params: {} }),
      "b".repeat(64),
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", retryable: false },
    });
  });

  it("rejects methods outside the runtime registry", () => {
    const response = handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "unknown-1", method: "model.delete", params: {} }),
      auth,
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "METHOD_NOT_FOUND", retryable: false },
    });
  });
});
