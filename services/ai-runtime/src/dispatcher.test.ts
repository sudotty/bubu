import { describe, expect, it } from "vitest";
import { createRpcRequest, mcpInspectionBudget, mcpPromptGetBudget, mcpResourceReadBudget } from "@bubu/contracts";
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

  it("propagates authenticated cancellation into an active MCP inspection", async () => {
    const dispatcher = createAiRuntimeDispatcher(auth, undefined, async (_invocation, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    );
    const active = dispatcher.dispatch(createRpcRequest({
      auth,
      id: "mcp-1",
      method: "mcp.inspect",
      params: {
        connectionId: "b".repeat(32),
        command: "/opt/bubu-mcp/bin/server",
        args: [], environment: {}, workingDirectory: "/tmp/bubu-mcp", budget: mcpInspectionBudget,
      },
    }));
    const cancelled = await dispatcher.dispatch(createRpcRequest({
      auth,
      id: "cancel-mcp-1",
      method: "system.cancel",
      params: { requestId: "mcp-1" },
    }));
    expect(cancelled).toMatchObject({ ok: true, result: { cancelled: true } });
    await expect(active).resolves.toMatchObject({ ok: false, error: { code: "CANCELLED" } });
  });

  it("propagates authenticated cancellation into an active MCP resource read", async () => {
    const dispatcher = createAiRuntimeDispatcher(auth, undefined, undefined, async (_invocation, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    );
    const active = dispatcher.dispatch(createRpcRequest({
      auth,
      id: "mcp-resource-1",
      method: "mcp.resource.read",
      params: {
        connectionId: "b".repeat(32),
        command: "/opt/bubu-mcp/bin/server",
        args: [], environment: {}, workingDirectory: "/tmp/bubu-mcp",
        resourceUri: "bubu-dictionary://definitions", budget: mcpResourceReadBudget,
      },
    }));
    const cancelled = await dispatcher.dispatch(createRpcRequest({
      auth,
      id: "cancel-mcp-resource-1",
      method: "system.cancel",
      params: { requestId: "mcp-resource-1" },
    }));
    expect(cancelled).toMatchObject({ ok: true, result: { cancelled: true } });
    await expect(active).resolves.toMatchObject({ ok: false, error: { code: "CANCELLED" } });
  });

  it("propagates authenticated cancellation into an active MCP prompt get", async () => {
    const dispatcher = createAiRuntimeDispatcher(auth, undefined, undefined, undefined, async (_invocation, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    );
    const active = dispatcher.dispatch(createRpcRequest({
      auth,
      id: "mcp-prompt-1",
      method: "mcp.prompt.get",
      params: {
        connectionId: "b".repeat(32),
        command: "/opt/bubu-mcp/bin/server",
        args: [], environment: {}, workingDirectory: "/tmp/bubu-mcp",
        promptName: "explain-term",
        arguments: [{ name: "term", value: "gross margin" }],
        budget: mcpPromptGetBudget,
      },
    }));
    const cancelled = await dispatcher.dispatch(createRpcRequest({
      auth,
      id: "cancel-mcp-prompt-1",
      method: "system.cancel",
      params: { requestId: "mcp-prompt-1" },
    }));
    expect(cancelled).toMatchObject({ ok: true, result: { cancelled: true } });
    await expect(active).resolves.toMatchObject({ ok: false, error: { code: "CANCELLED" } });
  });
});
