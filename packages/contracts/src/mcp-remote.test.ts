import { describe, expect, it } from "vitest";
import { parseRemoteMcpConnectionConfigurationInput, parseRemoteMcpInspectionInvocation, parseRemoteMcpToolCallInvocation } from "./mcp-remote.js";
import { mcpInspectionBudget } from "./mcp.js";

describe("remote MCP contracts", () => {
  it("accepts explicit HTTPS and public-client PKCE metadata", () => {
    expect(parseRemoteMcpConnectionConfigurationInput({ name: "Remote", serverUrl: "https://mcp.example.com/rpc", authorization: { kind: "oauth-pkce", authorizationEndpoint: "https://auth.example.com/authorize", tokenEndpoint: "https://auth.example.com/token", clientId: "bubu-desktop", scopes: ["mcp.read"] } }).authorization.kind).toBe("oauth-pkce");
  });

  it("binds a remote call to a schema hash and exact bounded arguments", () => {
    expect(parseRemoteMcpToolCallInvocation({ connectionId: "a".repeat(32), serverUrl: "https://mcp.example.com/rpc", resolvedAddresses: ["93.184.216.34"], toolName: "lookup", inputSchemaSha256: "b".repeat(64), taskSupport: "forbidden", arguments: { id: "42" }, budget: { maxDurationMs: 30_000, maxDiscoveryPages: 5, maxDiscoveredTools: 100, maxInputBytes: 32_768, maxContentParts: 20, maxDecodedBytes: 262_144, maxResultBytes: 393_216 } }).arguments).toEqual({ id: "42" });
  });

  it("rejects HTTP, credentials, fragments, duplicate scopes, and unbounded bearer input", () => {
    for (const serverUrl of ["http://mcp.example.com", "https://user:secret@mcp.example.com", "https://mcp.example.com/#fragment"]) {
      expect(() => parseRemoteMcpConnectionConfigurationInput({ name: "Remote", serverUrl, authorization: { kind: "none" } })).toThrow();
    }
    expect(() => parseRemoteMcpConnectionConfigurationInput({ name: "Remote", serverUrl: "https://mcp.example.com", authorization: { kind: "oauth-pkce", authorizationEndpoint: "https://auth.example.com/a", tokenEndpoint: "https://auth.example.com/t", clientId: "client", scopes: ["x", "x"] } })).toThrow("unique");
    expect(() => parseRemoteMcpInspectionInvocation({ connectionId: "a".repeat(32), serverUrl: "https://mcp.example.com", resolvedAddresses: ["93.184.216.34"], authorizationBearer: "x\nInjected", budget: mcpInspectionBudget })).toThrow("control");
  });
});
