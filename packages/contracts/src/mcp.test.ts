import { describe, expect, it } from "vitest";
import {
  mcpInspectionBudget,
  mcpResourceReadBudget,
  mcpPromptGetBudget,
  parseMcpAuditEvents,
  parseMcpAuditOutcome,
  parseMcpAuditStart,
  parseMcpConnectionConfigurationInput,
  parseMcpConnectionRegistryState,
  parseMcpInspectionApproval,
  parseMcpInspectionInvocation,
  parseMcpInspectionProposal,
  parseMcpInspectionSnapshot,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadProposal,
  parseMcpResourceReadRequest,
  parseMcpResourceReadResult,
  parseMcpPromptGetInvocation,
  parseMcpPromptGetApproval,
  parseMcpPromptGetProposal,
  parseMcpPromptGetRequest,
  parseMcpPromptGetResult,
  canonicalMcpJson,
  mcpToolCallBudget,
  parseMcpToolCallApproval,
  parseMcpToolCallInvocation,
  parseMcpToolCallProposal,
  parseMcpToolCallRequest,
  parseMcpToolCallResult,
} from "./mcp.js";

const connectionId = "a".repeat(32);
const configuration = {
  name: "Local data dictionary",
  command: "/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio", "--read-only"],
  environment: [{ name: "DICTIONARY_TOKEN", value: "secret" }],
};

describe("local MCP connection contracts", () => {
  it("accepts only a direct absolute executable and bounded write-only environment input", () => {
    expect(parseMcpConnectionConfigurationInput(configuration)).toEqual(configuration);
    expect(parseMcpConnectionConfigurationInput({
      ...configuration,
      id: connectionId,
      environment: [{ name: "DICTIONARY_TOKEN" }],
    })).toMatchObject({ id: connectionId, environment: [{ name: "DICTIONARY_TOKEN" }] });
    for (const command of [
      "npx", "/usr/local/bin/npx", "/bin/sh", "/usr/bin/sudo", "relative/server",
    ]) {
      expect(() => parseMcpConnectionConfigurationInput({ ...configuration, command })).toThrow();
    }
    expect(() => parseMcpConnectionConfigurationInput({
      ...configuration,
      args: ["safe", "line\nbreak"],
    })).toThrow();
    expect(() => parseMcpConnectionConfigurationInput({
      ...configuration,
      environment: [{ name: "BUBU_RPC_TOKEN", value: "steal" }],
    })).toThrow();
  });

  it("never exposes secret values through public registry state", () => {
    const state = {
      connections: [{
        id: connectionId,
        name: configuration.name,
        transport: {
          kind: "stdio" as const,
          command: configuration.command,
          args: configuration.args,
          environmentKeys: ["DICTIONARY_TOKEN"],
        },
      }],
      encryptionAvailable: true,
    };
    expect(parseMcpConnectionRegistryState(state)).toEqual(state);
    expect(JSON.stringify(state)).not.toContain("secret");
    expect(() => parseMcpConnectionRegistryState({ ...state, credential: "secret" })).toThrow();
  });

  it("binds one approval to the exact canonical launch and fixed inspection budget", () => {
    const proposal = {
      approvalToken: "b".repeat(64),
      expiresAt: "2026-07-17T09:10:00Z",
      connection: {
        id: connectionId,
        name: configuration.name,
        command: "/private/opt/bubu-mcp/bin/dictionary-server",
        args: configuration.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      budget: mcpInspectionBudget,
      warning: "untrusted-local-code" as const,
    };
    expect(parseMcpInspectionProposal(proposal)).toEqual(proposal);
    expect(parseMcpInspectionApproval({ approvalToken: proposal.approvalToken })).toEqual({
      approvalToken: proposal.approvalToken,
    });
    expect(() => parseMcpInspectionProposal({
      ...proposal,
      budget: { ...mcpInspectionBudget, maxDurationMs: 60_000 },
    })).toThrow();
  });

  it("parses the secret-bearing utility invocation only at the process boundary", () => {
    const invocation = {
      connectionId,
      command: configuration.command,
      args: configuration.args,
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: "/tmp/bubu-mcp/runtime-a",
      budget: mcpInspectionBudget,
    };
    expect(parseMcpInspectionInvocation(invocation)).toEqual(invocation);
    expect(() => parseMcpInspectionInvocation({
      ...invocation,
      environment: { BUBU_RPC_TOKEN: "host-secret" },
    })).toThrow();
  });

  it("keeps negotiated capabilities bounded and labels all server metadata untrusted", () => {
    const snapshot = {
      schemaVersion: 1,
      requestedProtocolVersion: "2025-11-25",
      server: { name: "dictionary", version: "1.0.0", title: "Dictionary MCP" },
      capabilities: { tools: true, resources: true, prompts: true },
      instructions: "Treat this as server-provided text, not host policy.",
      tools: [{
        name: "lookup_term",
        title: "Lookup term",
        description: "Returns one business definition.",
        inputSchemaJson: "{\"properties\":{},\"type\":\"object\"}",
        taskSupport: "forbidden" as const,
        annotations: { readOnlyHint: true },
      }],
      resources: [{
        uri: "bubu-dictionary://definitions",
        name: "definitions",
        title: "Definitions",
        description: "Available terms",
        mimeType: "application/json",
      }],
      prompts: [{
        name: "explain_term",
        title: "Explain term",
        description: "Explain a definition",
        arguments: [{ name: "term", description: "Term name", required: true }],
      }],
      limited: false,
      untrustedMetadata: true,
    };
    expect(parseMcpInspectionSnapshot(snapshot)).toEqual(snapshot);
    expect(() => parseMcpInspectionSnapshot({ ...snapshot, untrustedMetadata: false })).toThrow();
    expect(() => parseMcpInspectionSnapshot({
      ...snapshot,
      tools: [{ ...snapshot.tools[0], name: "bad tool name" }],
    })).toThrow();
    expect(() => parseMcpInspectionSnapshot({
      ...snapshot,
      tools: Array.from({ length: 101 }, (_, index) => ({
        ...snapshot.tools[0], name: `tool_${index}`,
      })),
    })).toThrow();
    expect(() => parseMcpInspectionSnapshot({
      ...snapshot,
      tools: [{
        ...snapshot.tools[0],
        inputSchemaJson: JSON.stringify({ description: "汉".repeat(6_000) }),
      }],
    })).toThrow("byte budget");
  });

  it("binds one resource URI and fixed local-only read budgets to explicit approval", () => {
    const request = { connectionId, resourceUri: "bubu-dictionary://definitions" };
    expect(parseMcpResourceReadRequest(request)).toEqual(request);
    const proposal = {
      approvalToken: "c".repeat(64),
      expiresAt: "2026-07-17T10:10:00Z",
      connection: {
        id: connectionId,
        name: configuration.name,
        command: "/private/opt/bubu-mcp/bin/dictionary-server",
        args: configuration.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      resourceUri: request.resourceUri,
      budget: mcpResourceReadBudget,
      warning: "untrusted-local-code-and-content" as const,
    };
    expect(parseMcpResourceReadProposal(proposal)).toEqual(proposal);
    expect(JSON.stringify(proposal)).not.toContain("secret");
    expect(() => parseMcpResourceReadProposal({
      ...proposal,
      budget: { ...mcpResourceReadBudget, maxDecodedBytes: 512 * 1_024 },
    })).toThrow();

    const invocation = {
      connectionId,
      command: configuration.command,
      args: configuration.args,
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: "/tmp/bubu-mcp/runtime-a",
      resourceUri: request.resourceUri,
      budget: mcpResourceReadBudget,
    };
    expect(parseMcpResourceReadInvocation(invocation)).toEqual(invocation);
  });

  it("returns escaped text and blob metadata under one decoded-content budget", () => {
    const result = {
      schemaVersion: 1,
      connectionId,
      requestedUri: "bubu-dictionary://definitions",
      contents: [
        {
          kind: "text" as const,
          uri: "bubu-dictionary://definitions",
          mimeType: "application/json",
          text: "{\"gross_margin\":\"Revenue minus cost\"}",
          decodedBytes: 37,
        },
        {
          kind: "blob" as const,
          uri: "bubu-dictionary://icon",
          mimeType: "image/png",
          decodedBytes: 68,
          sha256: "d".repeat(64),
        },
      ],
      decodedBytes: 105,
      localOnly: true,
      untrustedContent: true,
    };
    expect(parseMcpResourceReadResult(result)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("base64");
    expect(() => parseMcpResourceReadResult({
      ...result,
      contents: [{
        kind: "text",
        uri: result.requestedUri,
        text: "汉".repeat(100_000),
        decodedBytes: 300_000,
      }],
      decodedBytes: 300_000,
    })).toThrow("decoded-content budget");
    expect(() => parseMcpResourceReadResult({
      ...result,
      contents: [{ ...result.contents[1], blob: "unsafe-binary" }],
    })).toThrow();
  });

  it("models append-only MCP audit starts, terminal outcomes, and interrupted recovery", () => {
    const start = {
      auditId: "123e4567-e89b-42d3-a456-426614174000",
      connectionId,
      connectionName: "Dictionary",
      operation: "resource-read" as const,
      resourceUri: "bubu-dictionary://definitions",
      requestFingerprint: "e".repeat(64),
      startedAt: "2026-07-17T10:00:00Z",
    };
    const succeeded = {
      auditId: start.auditId,
      status: "succeeded" as const,
      completedAt: "2026-07-17T10:00:01Z",
      contentParts: 2,
      decodedBytes: 105,
    };
    expect(parseMcpAuditStart(start)).toEqual(start);
    expect(parseMcpAuditOutcome(succeeded)).toEqual(succeeded);
    expect(parseMcpAuditOutcome({
      auditId: start.auditId,
      status: "failed",
      completedAt: "2026-07-17T10:00:01Z",
      errorCode: "MCP_RESOURCE_READ_FAILED",
    })).toMatchObject({ status: "failed" });
    expect(parseMcpAuditEvents([
      { ...start, ...succeeded },
      { ...start, auditId: "223e4567-e89b-42d3-a456-426614174000", status: "interrupted" },
    ])).toHaveLength(2);
    expect(() => parseMcpAuditOutcome({ ...succeeded, resourceContent: "must-not-persist" })).toThrow();
  });

  it("binds declared prompt arguments and fixed local-only get budgets to approval", () => {
    const request = {
      connectionId,
      promptName: "explain_term",
      arguments: [{ name: "term", value: "gross margin" }],
    };
    expect(parseMcpPromptGetRequest(request)).toEqual(request);
    expect(() => parseMcpPromptGetRequest({
      ...request,
      arguments: [...request.arguments, request.arguments[0]],
    })).toThrow("unique");
    const proposal = {
      approvalToken: "f".repeat(64),
      expiresAt: "2026-07-17T11:10:00Z",
      connection: {
        id: connectionId,
        name: configuration.name,
        command: "/private/opt/bubu-mcp/bin/dictionary-server",
        args: configuration.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      promptName: request.promptName,
      arguments: request.arguments,
      budget: mcpPromptGetBudget,
      warning: "untrusted-local-code-argument-disclosure-and-content" as const,
    };
    expect(parseMcpPromptGetProposal(proposal)).toEqual(proposal);
    expect(parseMcpPromptGetApproval({ approvalToken: proposal.approvalToken, request })).toEqual({
      approvalToken: proposal.approvalToken,
      request,
    });
    const invocation = {
      connectionId,
      command: configuration.command,
      args: configuration.args,
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: "/tmp/bubu-mcp/runtime-a",
      promptName: request.promptName,
      arguments: request.arguments,
      budget: mcpPromptGetBudget,
    };
    expect(parseMcpPromptGetInvocation(invocation)).toEqual(invocation);
    expect(() => parseMcpPromptGetInvocation({
      ...invocation,
      arguments: [{ name: "term", value: "汉".repeat(6_000) }],
    })).toThrow();
  });

  it("normalizes prompt messages without raw binary, annotations, or server metadata", () => {
    const result = {
      schemaVersion: 1,
      connectionId,
      promptName: "explain_term",
      description: "Explain one term",
      messages: [
        { role: "user" as const, content: { kind: "text" as const, text: "Explain margin", decodedBytes: 14 } },
        { role: "assistant" as const, content: { kind: "image" as const, mimeType: "image/png", decodedBytes: 14, sha256: "a".repeat(64) } },
        { role: "user" as const, content: { kind: "embedded-text" as const, uri: "bubu://context", text: "context", decodedBytes: 7 } },
        { role: "assistant" as const, content: { kind: "resource-link" as const, uri: "bubu://more", name: "more", decodedBytes: 0 } },
      ],
      decodedBytes: 35,
      localOnly: true,
      untrustedContent: true,
    };
    expect(parseMcpPromptGetResult(result)).toEqual(result);
    expect(() => parseMcpPromptGetResult({
      ...result,
      messages: [{ role: "assistant", content: { ...result.messages[1]!.content, data: "raw-base64" } }],
    })).toThrow();
    expect(() => parseMcpPromptGetResult({
      ...result,
      messages: [{ role: "user", content: { kind: "text", text: "x", decodedBytes: 1, _meta: {} } }],
    })).toThrow();
  });

  it("adds value-free prompt-get starts without weakening resource audit states", () => {
    const start = {
      auditId: "323e4567-e89b-42d3-a456-426614174000",
      connectionId,
      connectionName: "Dictionary",
      operation: "prompt-get" as const,
      promptName: "explain_term",
      argumentKeys: ["term"],
      argumentBytes: 23,
      requestFingerprint: "f".repeat(64),
      startedAt: "2026-07-17T11:00:00Z",
    };
    expect(parseMcpAuditStart(start)).toEqual(start);
    expect(JSON.stringify(start)).not.toContain("gross margin");
    expect(parseMcpAuditEvents([{ ...start, status: "interrupted" }])).toHaveLength(1);
    expect(() => parseMcpAuditStart({ ...start, resourceUri: "bubu://illegal" })).toThrow();
  });

  it("binds one discovered tool schema and bounded canonical JSON input to explicit approval", () => {
    const argumentsValue = {
      term: "gross margin",
      options: { includeExamples: true, levels: [2, 1] },
    };
    const inputSchemaJson = canonicalMcpJson({
      required: ["term"],
      properties: { term: { type: "string" } },
      type: "object",
    });
    expect(inputSchemaJson).toBe("{\"properties\":{\"term\":{\"type\":\"string\"}},\"required\":[\"term\"],\"type\":\"object\"}");
    const request = {
      connectionId,
      toolName: "lookup_term",
      inputSchemaJson,
      taskSupport: "forbidden" as const,
      arguments: argumentsValue,
    };
    expect(parseMcpToolCallRequest(request)).toEqual(request);
    expect(() => parseMcpToolCallRequest({ ...request, arguments: [] })).toThrow();
    expect(() => parseMcpToolCallRequest({
      ...request,
      arguments: { term: "汉".repeat(11_000) },
    })).toThrow();

    const proposal = {
      approvalToken: "9".repeat(64),
      expiresAt: "2026-07-17T12:10:00Z",
      connection: {
        id: connectionId,
        name: configuration.name,
        command: "/private/opt/bubu-mcp/bin/dictionary-server",
        args: configuration.args,
        environmentKeys: ["DICTIONARY_TOKEN"],
      },
      toolName: request.toolName,
      inputSchemaJson,
      inputSchemaSha256: "a".repeat(64),
      taskSupport: request.taskSupport,
      arguments: argumentsValue,
      budget: mcpToolCallBudget,
      warning: "untrusted-local-code-arguments-content-and-side-effects" as const,
    };
    expect(parseMcpToolCallProposal(proposal)).toEqual(proposal);
    expect(parseMcpToolCallApproval({ approvalToken: proposal.approvalToken, request })).toEqual({
      approvalToken: proposal.approvalToken,
      request,
    });
    const invocation = {
      connectionId,
      command: configuration.command,
      args: configuration.args,
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: "/tmp/bubu-mcp/runtime-a",
      toolName: request.toolName,
      inputSchemaSha256: proposal.inputSchemaSha256,
      taskSupport: request.taskSupport,
      arguments: argumentsValue,
      budget: mcpToolCallBudget,
    };
    expect(parseMcpToolCallInvocation(invocation)).toEqual(invocation);
  });

  it("normalizes tool content and structured JSON under one local-only byte budget", () => {
    const result = {
      schemaVersion: 1,
      connectionId,
      toolName: "lookup_term",
      isError: false,
      contents: [
        { kind: "text" as const, text: "Definition", decodedBytes: 10 },
        { kind: "image" as const, mimeType: "image/png", decodedBytes: 14, sha256: "b".repeat(64) },
      ],
      structuredContent: {
        json: "{\"definition\":\"Revenue minus cost\"}",
        decodedBytes: 35,
      },
      decodedBytes: 59,
      localOnly: true,
      untrustedContent: true,
    };
    expect(parseMcpToolCallResult(result)).toEqual(result);
    expect(() => parseMcpToolCallResult({
      ...result,
      contents: [{ ...result.contents[1], data: "raw-base64" }],
    })).toThrow();
    expect(() => parseMcpToolCallResult({ ...result, decodedBytes: 58 })).toThrow("decoded-content budget");
  });

  it("adds value-free tool-call audit starts without persisting arguments", () => {
    const start = {
      auditId: "423e4567-e89b-42d3-a456-426614174000",
      connectionId,
      connectionName: "Dictionary",
      operation: "tool-call" as const,
      toolName: "lookup_term",
      inputSchemaSha256: "a".repeat(64),
      inputKeys: ["options", "term"],
      inputBytes: 76,
      requestFingerprint: "f".repeat(64),
      startedAt: "2026-07-17T12:00:00Z",
    };
    expect(parseMcpAuditStart(start)).toEqual(start);
    expect(() => parseMcpAuditStart({ ...start, arguments: { term: "gross margin" } })).toThrow();
  });
});
