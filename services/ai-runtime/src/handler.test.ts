import { describe, expect, it } from "vitest";
import {
  createRpcRequest,
  mcpInspectionBudget,
  mcpPromptGetBudget,
  mcpResourceReadBudget,
  mcpToolCallBudget,
  parseServiceHealth,
} from "@bubu/contracts";
import { handleAiRuntimeRequest } from "./handler.js";

const auth = "a".repeat(64);

describe("AI runtime request handler", () => {
  it("returns versioned readiness for an authenticated health request", async () => {
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "health-1", method: "system.health", params: {} }),
      auth,
    );

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("expected success");
    expect(parseServiceHealth(response.result)).toEqual({
      service: "ai-runtime",
      protocolVersion: 1,
      status: "ready",
      capabilities: [
        "openai-responses",
        "anthropic-messages",
        "gemini-interactions",
        "openai-compatible",
        "ollama",
        "bounded-http",
        "cancellable-requests",
        "mcp-stdio-inspection",
        "mcp-resource-read",
        "mcp-prompt-get",
        "mcp-tool-call",
      ],
    });
  });

  it("does not execute a request with the wrong process token", async () => {
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "health-1", method: "system.health", params: {} }),
      "b".repeat(64),
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", retryable: false },
    });
  });

  it("rejects methods outside the runtime registry", async () => {
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "unknown-1", method: "model.delete", params: {} }),
      auth,
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "METHOD_NOT_FOUND", retryable: false },
    });
  });

  it("executes a parsed model invocation through the selected adapter", async () => {
    const response = await handleAiRuntimeRequest(
      createRpcRequest({
        auth,
        id: "generate-1",
        method: "model.generate",
        params: {
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
          maxOutputTokens: 512,
        },
      }),
      auth,
      async () =>
        new Response(
          JSON.stringify({ output: [{ content: [{ type: "output_text", text: "answer" }] }] }),
          { status: 200 },
        ),
    );

    expect(response).toMatchObject({ ok: true, result: { text: "answer", providerKind: "openai" } });
  });

  it("executes only a parsed MCP inspection invocation through the named inspector", async () => {
    const invocation = {
      connectionId: "b".repeat(32),
      command: "/opt/bubu-mcp/bin/server",
      args: ["--stdio"],
      environment: {},
      workingDirectory: "/tmp/bubu-mcp-runtime",
      budget: mcpInspectionBudget,
    };
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-1", method: "mcp.inspect", params: invocation }),
      auth,
      undefined,
      undefined,
      async (parsed) => ({
        schemaVersion: 1,
        requestedProtocolVersion: "2025-11-25",
        server: { name: parsed.connectionId, version: "1.0.0" },
        capabilities: { tools: false, resources: false, prompts: false },
        instructions: null,
        tools: [], resources: [], prompts: [], limited: false, untrustedMetadata: true,
      }),
    );
    expect(response).toMatchObject({ ok: true, result: { server: { name: invocation.connectionId } } });

    const invalid = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-2", method: "mcp.inspect", params: { command: "npx" } }),
      auth,
    );
    expect(invalid).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  it("executes only a parsed MCP resource invocation through the named reader", async () => {
    const invocation = {
      connectionId: "b".repeat(32),
      command: "/opt/bubu-mcp/bin/server",
      args: ["--stdio"],
      environment: {},
      workingDirectory: "/tmp/bubu-mcp-runtime",
      resourceUri: "bubu-dictionary://definitions",
      budget: mcpResourceReadBudget,
    };
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-resource-1", method: "mcp.resource.read", params: invocation }),
      auth,
      undefined,
      undefined,
      undefined,
      async (parsed) => ({
        schemaVersion: 1,
        connectionId: parsed.connectionId,
        requestedUri: parsed.resourceUri,
        contents: [{
          kind: "text",
          uri: parsed.resourceUri,
          text: "local content",
          decodedBytes: 13,
        }],
        decodedBytes: 13,
        localOnly: true,
        untrustedContent: true,
      }),
    );
    expect(response).toMatchObject({ ok: true, result: { requestedUri: invocation.resourceUri } });

    const invalid = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-resource-2", method: "mcp.resource.read", params: { resourceUri: "x" } }),
      auth,
    );
    expect(invalid).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  it("executes only a parsed MCP prompt invocation through the named getter", async () => {
    const invocation = {
      connectionId: "b".repeat(32),
      command: "/opt/bubu-mcp/bin/server",
      args: ["--stdio"],
      environment: {},
      workingDirectory: "/tmp/bubu-mcp-runtime",
      promptName: "explain-term",
      arguments: [{ name: "term", value: "gross margin" }],
      budget: mcpPromptGetBudget,
    };
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-prompt-1", method: "mcp.prompt.get", params: invocation }),
      auth,
      undefined,
      undefined,
      undefined,
      undefined,
      async (parsed) => ({
        schemaVersion: 1,
        connectionId: parsed.connectionId,
        promptName: parsed.promptName,
        messages: [{
          role: "user",
          content: { kind: "text", text: "local prompt", decodedBytes: 12 },
        }],
        decodedBytes: 12,
        localOnly: true,
        untrustedContent: true,
      }),
    );
    expect(response).toMatchObject({ ok: true, result: { promptName: invocation.promptName } });

    const invalid = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-prompt-2", method: "mcp.prompt.get", params: { promptName: "x" } }),
      auth,
    );
    expect(invalid).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  it("executes only a parsed MCP tool invocation through the named caller", async () => {
    const invocation = {
      connectionId: "b".repeat(32),
      command: "/opt/bubu-mcp/bin/server",
      args: ["--stdio"],
      environment: {},
      workingDirectory: "/tmp/bubu-mcp-runtime",
      toolName: "lookup_term",
      inputSchemaSha256: "c".repeat(64),
      taskSupport: "forbidden" as const,
      arguments: { term: "gross margin" },
      budget: mcpToolCallBudget,
    };
    const response = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-tool-1", method: "mcp.tool.call", params: invocation }),
      auth,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      async (parsed) => ({
        schemaVersion: 1,
        connectionId: parsed.connectionId,
        toolName: parsed.toolName,
        isError: false,
        contents: [{ kind: "text", text: "local result", decodedBytes: 12 }],
        structuredContent: null,
        decodedBytes: 12,
        localOnly: true,
        untrustedContent: true,
      }),
    );
    expect(response).toMatchObject({ ok: true, result: { toolName: invocation.toolName } });

    const invalid = await handleAiRuntimeRequest(
      createRpcRequest({ auth, id: "mcp-tool-2", method: "mcp.tool.call", params: { toolName: "x" } }),
      auth,
    );
    expect(invalid).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });
});
