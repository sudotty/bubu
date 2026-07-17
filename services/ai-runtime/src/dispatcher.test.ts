import { describe, expect, it } from "vitest";
import { createRpcRequest } from "@bubu/contracts";
import { createAiRuntimeDispatcher } from "./dispatcher.js";

const auth = "a".repeat(64);
const invocation = {
  provider: {
    id: "a".repeat(32),
    name: "OpenAI",
    kind: "openai" as const,
    baseUrl: "https://api.openai.com/v1/",
    model: "configured-model",
  },
  credential: "private-key",
  system: "System",
  user: "User",
};

describe("AI runtime dispatcher", () => {
  it("aborts an active provider request through the authenticated control method", async () => {
    const dispatcher = createAiRuntimeDispatcher(auth, async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    );
    const active = dispatcher.dispatch(createRpcRequest({
      auth,
      id: "generate-1",
      method: "model.generate",
      params: invocation,
    }));
    const cancelled = await dispatcher.dispatch(createRpcRequest({
      auth,
      id: "cancel-1",
      method: "system.cancel",
      params: { requestId: "generate-1" },
    }));

    expect(cancelled).toMatchObject({ ok: true, result: { cancelled: true } });
    await expect(active).resolves.toMatchObject({ ok: false, error: { code: "CANCELLED" } });
  });
});
