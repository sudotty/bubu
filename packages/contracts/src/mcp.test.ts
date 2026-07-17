import { describe, expect, it } from "vitest";
import {
  mcpInspectionBudget,
  parseMcpConnectionConfigurationInput,
  parseMcpConnectionRegistryState,
  parseMcpInspectionApproval,
  parseMcpInspectionInvocation,
  parseMcpInspectionProposal,
  parseMcpInspectionSnapshot,
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
        inputSchemaJson: "{\"type\":\"object\",\"properties\":{}}",
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
});
